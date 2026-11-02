/**
 * Gilded Salon audio engine.
 *
 * Graph:  voices ─► sfx bus ───┐
 *                              ├─► master gain ─► limiter (DynamicsCompressor) ─► destination
 *         music ─► music bus ──┘        ▲
 *         sfx/music sends ─► room (procedural IR convolver) ─┘
 *
 * Everything degrades to a no-op where WebAudio is unavailable (SSR, node, very old browsers).
 */
import { MusicSequencer } from './music';
import { OVERRIDE_FILES, musicOverrideKey, overrideUrlFor, type OverrideKey } from './overrides';
import {
	DEDUPE_WINDOW,
	LOOP_FADE,
	MASTER_TRIM,
	MAX_ONE_SHOTS,
	MUSIC_BUS_DB,
	MUSIC_CROSSFADE,
	ROOM_SEND,
	SCHEDULE_AHEAD,
	SCHEDULER_INTERVAL_MS,
	STACKABLE,
	dbToGain,
	gainForVolume,
	keyPitch,
	tickPitch,
	type LoopName,
	type MusicTrack,
	type MusicTrackName,
	type PlayOptions,
	type SfxName,
} from './soundMap';
import { clamp, loopSegments, makeRoomIR, voices } from './voices';

export type AudioApi = {
	/** Create/resume the AudioContext; call from a user gesture. Safe to call many times. */
	unlock(): Promise<void>;
	/** One-shot; no-op before unlock or when muted. */
	play(name: SfxName, opts?: PlayOptions): void;
	/** Start a looping layer (idempotent). */
	loop(name: LoopName): void;
	/** Stop a loop with a 120 ms fade (one-shots are left to ring out). */
	stop(name: SfxName): void;
	/** Crossfade (1.2 s) to a track; null fades the music out. */
	music(track: MusicTrack): void;
	/** Master volume 0..1; 0 silences everything, music included. */
	setVolume(v: number): void;
	/** Music and effects levels 0..1 under the master (the SDK settings sliders). */
	setBusVolumes(levels: { music?: number; sfx?: number }): void;
	suspend(): void;
	resume(): void;
};

// ---- graph ------------------------------------------------------------------------------------------

/**
 * Limiter settings. `makeupCompensation` = 1 / the compressor's automatic makeup gain for these
 * settings (measured in Chrome: ×1.13556, identical at 44.1/48 kHz and any level below threshold;
 * tools/audio-check.mjs re-verifies unity gain).
 */
export const LIMITER = {
	threshold: -3,
	knee: 3,
	ratio: 12,
	attack: 0.004,
	release: 0.2,
	makeupCompensation: 1 / 1.13556,
} as const;

export type Graph = {
	master: GainNode;
	sfx: GainNode;
	music: GainNode;
	limiter: DynamicsCompressorNode | null;
};

/**
 * Build the bus graph on any (online or offline) context. `limiter: false` leaves the
 * compressor out — used by the offline check to measure raw headroom.
 */
export function buildGraph(
	ctx: BaseAudioContext,
	destination: AudioNode = ctx.destination,
	{ limiter = true }: { limiter?: boolean } = {},
): Graph {
	const master = ctx.createGain();
	master.gain.value = MASTER_TRIM;
	let comp: DynamicsCompressorNode | null = null;
	if (limiter) {
		comp = ctx.createDynamicsCompressor();
		// Gentle safety limiter: only the loudest stinger peaks should ever touch it.
		comp.threshold.value = LIMITER.threshold;
		comp.knee.value = LIMITER.knee;
		comp.ratio.value = LIMITER.ratio;
		comp.attack.value = LIMITER.attack;
		comp.release.value = LIMITER.release;
		// The spec'd compressor always adds automatic makeup gain ((1 / curve(1))^0.6); undo it so
		// the limiter is unity below threshold instead of lifting the whole mix.
		const unity = ctx.createGain();
		unity.gain.value = LIMITER.makeupCompensation;
		master.connect(comp);
		comp.connect(unity);
		unity.connect(destination);
	} else {
		master.connect(destination);
	}

	const room = ctx.createConvolver();
	room.buffer = makeRoomIR(ctx, 1.6);
	room.connect(master);

	const sfx = ctx.createGain();
	sfx.connect(master);
	const sfxSend = ctx.createGain();
	sfxSend.gain.value = ROOM_SEND;
	sfx.connect(sfxSend);
	sfxSend.connect(room);

	const music = ctx.createGain();
	music.gain.value = dbToGain(MUSIC_BUS_DB);
	music.connect(master);
	const musicSend = ctx.createGain();
	musicSend.gain.value = ROOM_SEND;
	music.connect(musicSend);
	musicSend.connect(room);

	return { master, sfx, music, limiter: comp };
}

// ---- engine -----------------------------------------------------------------------------------------

export type EngineOptions = {
	/** Context factory (default: a new AudioContext, or null without WebAudio). */
	createContext?: () => AudioContext | null;
	/** Where the limiter connects (default: ctx.destination). */
	destination?: (ctx: AudioContext) => AudioNode;
	/** Override files (glob path → url). Default: the bundled `override/` folder. */
	overrides?: Record<string, string>;
};

type LoopRun = {
	name: LoopName;
	gain: GainNode;
	next: number;
	n: number;
	opts: PlayOptions;
	source?: AudioBufferSourceNode;
};

type MusicRun = {
	track: MusicTrackName;
	gain: GainNode;
	seq?: MusicSequencer;
	source?: AudioBufferSourceNode;
	/** When set, the run is fading out and is torn down after this time. */
	endsAt?: number;
};

function defaultContext(): AudioContext | null {
	const g = globalThis as unknown as {
		AudioContext?: typeof AudioContext;
		webkitAudioContext?: typeof AudioContext;
	};
	const Ctor = g.AudioContext ?? g.webkitAudioContext;
	if (typeof Ctor !== 'function') return null;
	try {
		return new Ctor({ latencyHint: 'interactive' });
	} catch {
		try {
			return new Ctor();
		} catch {
			return null;
		}
	}
}

const sanitizeVolume = (v: number) => (Number.isFinite(v) ? clamp(v, 0, 1) : v === Infinity ? 1 : 0);

export class AudioEngine implements AudioApi {
	private ctx: AudioContext | null = null;
	private graph: Graph | null = null;
	private volume = 1;
	private busLevels = { music: 1, sfx: 1 };
	private lastPlayed = new Map<SfxName, number>();
	private sounding: number[] = [];
	private loops = new Map<LoopName, LoopRun>();
	private desiredTrack: MusicTrack = null;
	private current: MusicRun | null = null;
	private fading: MusicRun[] = [];
	private timer: ReturnType<typeof setInterval> | null = null;
	private hidden = false;
	private appSuspended = false;
	private visibilityBound = false;
	private buffers = new Map<string, AudioBuffer | null>();
	private decoding = new Set<string>();
	private readonly overrides: Record<string, string>;

	constructor(private readonly options: EngineOptions = {}) {
		this.overrides = options.overrides ?? OVERRIDE_FILES;
	}

	// ---- lifecycle ----

	async unlock(): Promise<void> {
		try {
			if (!this.ctx) {
				const ctx = (this.options.createContext ?? defaultContext)();
				if (!ctx) return;
				this.ctx = ctx;
				this.graph = buildGraph(ctx, this.options.destination?.(ctx) ?? ctx.destination);
				this.applyVolume(true);
				this.applyBusVolumes();
				this.bindVisibility();
				this.timer = setInterval(() => this.pump(), SCHEDULER_INTERVAL_MS);
				this.preloadOverrides();
				if (this.desiredTrack) this.startMusic(this.desiredTrack);
			}
			const ctx = this.ctx;
			if (ctx.state !== 'running' && !this.hidden && !this.appSuspended) {
				this.primeIOS(ctx);
				// resume() can stay pending without a user gesture; never block the caller on it.
				await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
			}
			this.pump();
		} catch {
			/* audio is best-effort */
		}
	}

	/** Tear down (tests / HMR). */
	dispose() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		for (const run of this.loops.values()) this.endLoop(run);
		this.loops.clear();
		this.current = null;
		this.fading = [];
	}

	suspend() {
		this.appSuspended = true;
		this.applySuspension();
	}

	resume() {
		this.appSuspended = false;
		this.applySuspension();
	}

	private applySuspension() {
		const ctx = this.ctx;
		if (!ctx) return;
		try {
			if (this.hidden || this.appSuspended) {
				if (ctx.state === 'running') void ctx.suspend().catch(() => {});
			} else if (ctx.state !== 'running' && ctx.state !== 'closed') {
				void ctx.resume().catch(() => {});
			}
		} catch {
			/* ignore */
		}
	}

	private bindVisibility() {
		if (this.visibilityBound || typeof document === 'undefined' || typeof document.addEventListener !== 'function')
			return;
		this.visibilityBound = true;
		const sync = () => {
			this.hidden = document.visibilityState === 'hidden';
			this.applySuspension();
		};
		document.addEventListener('visibilitychange', sync);
		this.hidden = document.visibilityState === 'hidden';
	}

	/** Old iOS Safari only unlocks after a buffer is started inside the gesture. */
	private primeIOS(ctx: AudioContext) {
		try {
			const src = ctx.createBufferSource();
			src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
			src.connect(ctx.destination);
			src.onended = () => src.disconnect();
			src.start(0);
		} catch {
			/* ignore */
		}
	}

	// ---- volume ----

	setVolume(v: number) {
		this.volume = sanitizeVolume(v);
		this.applyVolume(false);
	}

	setBusVolumes(levels: { music?: number; sfx?: number }) {
		if (levels.music !== undefined) this.busLevels.music = sanitizeVolume(levels.music);
		if (levels.sfx !== undefined) this.busLevels.sfx = sanitizeVolume(levels.sfx);
		this.applyBusVolumes();
	}

	private applyBusVolumes() {
		const ctx = this.ctx;
		const g = this.graph;
		if (!ctx || !g) return;
		const t = ctx.currentTime;
		const set = (param: AudioParam, target: number) => {
			try {
				param.cancelScheduledValues(t);
				param.setValueAtTime(param.value, t);
				param.linearRampToValueAtTime(target, t + 0.03);
			} catch {
				param.value = target;
			}
		};
		set(g.sfx.gain, gainForVolume(this.busLevels.sfx));
		set(g.music.gain, gainForVolume(this.busLevels.music) * dbToGain(MUSIC_BUS_DB));
	}

	private get muted() {
		return this.volume <= 0;
	}

	private applyVolume(immediate: boolean) {
		const ctx = this.ctx;
		const g = this.graph;
		if (!ctx || !g) return;
		const target = gainForVolume(this.volume) * MASTER_TRIM;
		const p = g.master.gain;
		const t = ctx.currentTime;
		try {
			p.cancelScheduledValues(t);
			if (immediate) {
				p.setValueAtTime(target, t);
			} else {
				p.setValueAtTime(p.value, t);
				p.linearRampToValueAtTime(target, t + 0.03);
			}
		} catch {
			p.value = target;
		}
	}

	// ---- one-shots ----

	play(name: SfxName, opts: PlayOptions = {}) {
		const ctx = this.ctx;
		const g = this.graph;
		if (!ctx || !g || this.muted) return;
		try {
			// A running count-up loop takes progress updates instead of extra ticks.
			const run = name === 'countTick' ? this.loops.get('countTick') : undefined;
			if (run) {
				run.opts = { ...run.opts, index: opts.index };
				if (run.source) run.source.playbackRate.value = tickPitch(opts.index ?? 0);
				return;
			}
			const now = ctx.currentTime;
			if (!STACKABLE.has(name)) {
				const last = this.lastPlayed.get(name);
				if (last !== undefined && now - last < DEDUPE_WINDOW) return;
			}
			this.sounding = this.sounding.filter((end) => end > now);
			if (this.sounding.length >= MAX_ONE_SHOTS) return;
			this.lastPlayed.set(name, now);

			let out: AudioNode = g.sfx;
			let level: GainNode | null = null;
			if (opts.volume !== undefined && opts.volume < 1) {
				level = ctx.createGain();
				level.gain.value = sanitizeVolume(opts.volume);
				level.connect(g.sfx);
				out = level;
			}
			const buffer = this.overrideBuffer(name);
			const dur = buffer ? this.playBuffer(buffer, out, now, name, opts) : voices[name](ctx, out, now, opts);
			this.sounding.push(now + dur);
			if (level) {
				const node = level;
				setTimeout(() => node.disconnect(), (dur + 0.5) * 1000);
			}
		} catch {
			/* never let audio break the game */
		}
	}

	private playBuffer(buffer: AudioBuffer, out: AudioNode, when: number, name: SfxName, opts: PlayOptions) {
		const ctx = this.ctx!;
		const src = ctx.createBufferSource();
		src.buffer = buffer;
		let rate = 1;
		if (name === 'keyLand') rate = keyPitch(opts.index ?? 1);
		if (name === 'countTick') rate = tickPitch(opts.index ?? 0);
		src.playbackRate.value = rate;
		let dest = out;
		let pan: StereoPannerNode | null = null;
		if (name === 'reelStop' && typeof ctx.createStereoPanner === 'function') {
			pan = ctx.createStereoPanner();
			pan.pan.value = -0.4 + 0.2 * clamp(Math.round(opts.index ?? 2), 0, 4);
			pan.connect(out);
			dest = pan;
		}
		src.connect(dest);
		src.onended = () => {
			src.disconnect();
			pan?.disconnect();
		};
		src.start(when);
		return buffer.duration / rate;
	}

	// ---- loops ----

	loop(name: LoopName) {
		const ctx = this.ctx;
		const g = this.graph;
		if (!ctx || !g || this.loops.has(name) || !(name in loopSegments)) return;
		try {
			const gain = ctx.createGain();
			gain.connect(g.sfx);
			const run: LoopRun = { name, gain, next: ctx.currentTime + 0.01, n: 0, opts: { index: 0 } };
			const buffer = this.overrideBuffer(name);
			if (buffer) {
				const src = ctx.createBufferSource();
				src.buffer = buffer;
				src.loop = true;
				src.connect(gain);
				src.start(run.next);
				run.source = src;
			}
			this.loops.set(name, run);
			this.pump();
		} catch {
			/* ignore */
		}
	}

	stop(name: SfxName) {
		const run = this.loops.get(name as LoopName);
		if (!run) return;
		this.loops.delete(run.name);
		this.endLoop(run);
	}

	private endLoop(run: LoopRun) {
		const ctx = this.ctx;
		if (!ctx) return;
		try {
			const t = ctx.currentTime;
			const p = run.gain.gain;
			p.cancelScheduledValues(t);
			p.setValueAtTime(p.value, t);
			p.linearRampToValueAtTime(0, t + LOOP_FADE);
			run.source?.stop(t + LOOP_FADE + 0.02);
		} catch {
			/* ignore */
		}
		setTimeout(() => {
			try {
				run.gain.disconnect();
				run.source?.disconnect();
			} catch {
				/* ignore */
			}
		}, (LOOP_FADE + 0.3) * 1000);
	}

	// ---- music ----

	music(track: MusicTrack) {
		this.desiredTrack = track;
		if (!this.ctx || !this.graph) return;
		if ((this.current?.track ?? null) === track) return;
		try {
			if (this.current) this.fadeOutMusic(this.current);
			this.current = null;
			if (track) this.startMusic(track);
		} catch {
			/* ignore */
		}
	}

	private startMusic(track: MusicTrackName) {
		const ctx = this.ctx!;
		const t = ctx.currentTime;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(1, t + MUSIC_CROSSFADE);
		gain.connect(this.graph!.music);
		const run: MusicRun = { track, gain };
		const buffer = this.overrideBuffer(musicOverrideKey(track));
		if (buffer) {
			const src = ctx.createBufferSource();
			src.buffer = buffer;
			src.loop = true;
			src.connect(gain);
			src.start(t + 0.02);
			run.source = src;
		} else {
			run.seq = new MusicSequencer(ctx, gain, track, t + 0.05);
		}
		this.current = run;
		this.pump();
	}

	private fadeOutMusic(run: MusicRun) {
		const ctx = this.ctx!;
		const t = ctx.currentTime;
		const p = run.gain.gain;
		p.cancelScheduledValues(t);
		p.setValueAtTime(p.value, t);
		p.linearRampToValueAtTime(0, t + MUSIC_CROSSFADE);
		run.endsAt = t + MUSIC_CROSSFADE;
		run.source?.stop(t + MUSIC_CROSSFADE + 0.05);
		this.fading.push(run);
	}

	// ---- scheduler ----

	/** Lookahead scheduler tick: commit loop segments and music steps up to SCHEDULE_AHEAD ahead. */
	private pump() {
		const ctx = this.ctx;
		if (!ctx) return;
		try {
			const now = ctx.currentTime;
			const horizon = now + SCHEDULE_AHEAD;
			const silent = this.muted;

			for (const run of this.loops.values()) {
				if (run.source) continue;
				if (run.next < now - 0.05) run.next = now; // timer stalled: resync, don't burst
				while (run.next < horizon) {
					const step = silent ? 0.1 : loopSegments[run.name](ctx, run.gain, run.next, run.opts, run.n);
					run.n++;
					run.next += Math.max(0.005, step);
				}
			}

			this.current?.seq?.pump(horizon, now, silent);
			this.fading = this.fading.filter((run) => {
				if (run.endsAt !== undefined && now >= run.endsAt) {
					const gain = run.gain;
					setTimeout(() => gain.disconnect(), 3000); // let scheduled tails ring into silence
					return false;
				}
				run.seq?.pump(horizon, now, silent);
				return true;
			});
		} catch {
			/* ignore */
		}
	}

	// ---- overrides ----

	private overrideBuffer(key: OverrideKey): AudioBuffer | undefined {
		const url = overrideUrlFor(key, this.overrides);
		if (!url) return undefined;
		const buf = this.buffers.get(url);
		if (buf) return buf;
		if (buf === undefined) this.decode(url);
		return undefined; // not decoded (yet / failed): fall back to the synth voice
	}

	private preloadOverrides() {
		for (const url of Object.values(this.overrides)) this.decode(url);
	}

	private decode(url: string) {
		const ctx = this.ctx;
		if (!ctx || this.decoding.has(url) || typeof fetch !== 'function') return;
		this.decoding.add(url);
		fetch(url)
			.then((r) => r.arrayBuffer())
			.then(
				(data) =>
					new Promise<AudioBuffer>((resolve, reject) => {
						// callback form: works on old Safari, which never returns a promise
						const p = ctx.decodeAudioData(data, resolve, reject);
						if (p && typeof p.then === 'function') p.then(resolve, reject);
					}),
			)
			.then((buffer) => this.buffers.set(url, buffer))
			.catch(() => this.buffers.set(url, null));
	}
}

export const createAudioEngine = (options?: EngineOptions) => new AudioEngine(options);
