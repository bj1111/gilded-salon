import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { audio, SFX_NAMES as INDEX_SFX_NAMES } from './index';
import { AudioEngine, LIMITER } from './engine';
import { MusicSequencer, renderMusic, MUSIC_TRACKS } from './music';
import { LOOP_NAMES, SFX_NAMES, type SfxName } from './soundMap';
import { loopSegments, voices } from './voices';

// ---------------------------------------------------------------------------------------------
// A small recording fake of the WebAudio API. It mirrors the browser's validation rules that
// matter for synth code (non-finite values, exponential ramps to <= 0, start/stop ordering) so
// mistakes show up here rather than as console errors in the game.
// ---------------------------------------------------------------------------------------------

type ParamEvent = { type: string; value: number; time: number };

const finite = (...nums: number[]) => {
	for (const n of nums) if (!Number.isFinite(n)) throw new TypeError(`non-finite value ${n}`);
};

class FakeParam {
	events: ParamEvent[] = [];
	constructor(public value = 0) {}
	setValueAtTime(value: number, time: number) {
		finite(value, time);
		if (time < 0) throw new RangeError('negative time');
		this.events.push({ type: 'set', value, time });
		return this;
	}
	linearRampToValueAtTime(value: number, time: number) {
		finite(value, time);
		if (time < 0) throw new RangeError('negative time');
		this.events.push({ type: 'linear', value, time });
		return this;
	}
	exponentialRampToValueAtTime(value: number, time: number) {
		finite(value, time);
		if (value <= 0) throw new RangeError('exponential ramp to a non-positive value');
		if (time < 0) throw new RangeError('negative time');
		this.events.push({ type: 'exp', value, time });
		return this;
	}
	setTargetAtTime(value: number, time: number, tc: number) {
		finite(value, time, tc);
		if (tc < 0) throw new RangeError('negative time constant');
		this.events.push({ type: 'target', value, time });
		return this;
	}
	cancelScheduledValues(time: number) {
		finite(time);
		this.events = this.events.filter((e) => e.time < time);
		return this;
	}
	/** The value this param ends up at once every scheduled event has run. */
	get final() {
		return this.events.length ? this.events[this.events.length - 1].value : this.value;
	}
}

class FakeNode {
	outputs = new Set<FakeNode | FakeParam>();
	constructor(
		public ctx: FakeContext,
		public kind: string,
	) {
		ctx.nodes.push(this);
	}
	connect(dest: FakeNode | FakeParam) {
		if (!dest) throw new TypeError('connect() to nothing');
		this.outputs.add(dest);
		return dest;
	}
	disconnect() {
		this.outputs.clear();
	}
}

class FakeSource extends FakeNode {
	started?: number;
	stopped?: number;
	onended: (() => void) | null = null;
	start(t = 0) {
		finite(t);
		if (this.started !== undefined) throw new Error('InvalidStateError: start() twice');
		this.started = t;
	}
	stop(t = 0) {
		finite(t);
		if (this.started === undefined) throw new Error('InvalidStateError: stop() before start()');
		this.stopped = t;
	}
	end() {
		this.onended?.();
	}
}

class FakeOsc extends FakeSource {
	type = 'sine';
	frequency = new FakeParam(440);
	detune = new FakeParam(0);
}

class FakeBufferSource extends FakeSource {
	buffer: FakeBuffer | null = null;
	loop = false;
	playbackRate = new FakeParam(1);
	detune = new FakeParam(0);
}

class FakeGain extends FakeNode {
	gain = new FakeParam(1);
}

class FakeBiquad extends FakeNode {
	type = 'lowpass';
	frequency = new FakeParam(350);
	Q = new FakeParam(1);
	gain = new FakeParam(0);
	detune = new FakeParam(0);
}

class FakePanner extends FakeNode {
	pan = new FakeParam(0);
}

class FakeDelay extends FakeNode {
	delayTime = new FakeParam(0);
}

class FakeCompressor extends FakeNode {
	threshold = new FakeParam(-24);
	knee = new FakeParam(30);
	ratio = new FakeParam(12);
	attack = new FakeParam(0.003);
	release = new FakeParam(0.25);
	reduction = 0;
}

class FakeConvolver extends FakeNode {
	buffer: FakeBuffer | null = null;
	normalize = true;
}

class FakeBuffer {
	private data: Float32Array[];
	constructor(
		public numberOfChannels: number,
		public length: number,
		public sampleRate: number,
	) {
		finite(numberOfChannels, length, sampleRate);
		if (length <= 0) throw new RangeError('empty buffer');
		this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
	}
	get duration() {
		return this.length / this.sampleRate;
	}
	getChannelData(c: number) {
		return this.data[c];
	}
}

class FakeContext {
	currentTime = 0;
	sampleRate = 48000;
	state: 'suspended' | 'running' | 'closed' = 'suspended';
	nodes: FakeNode[] = [];
	destination: FakeNode;
	resumeCalls = 0;
	suspendCalls = 0;
	constructor() {
		this.destination = new FakeNode(this, 'destination');
	}
	async resume() {
		this.resumeCalls++;
		this.state = 'running';
	}
	async suspend() {
		this.suspendCalls++;
		this.state = 'suspended';
	}
	createGain() {
		return new FakeGain(this, 'gain');
	}
	createOscillator() {
		return new FakeOsc(this, 'osc');
	}
	createBufferSource() {
		return new FakeBufferSource(this, 'bufferSource');
	}
	createBiquadFilter() {
		return new FakeBiquad(this, 'biquad');
	}
	createStereoPanner() {
		return new FakePanner(this, 'panner');
	}
	createDelay() {
		return new FakeDelay(this, 'delay');
	}
	createDynamicsCompressor() {
		return new FakeCompressor(this, 'compressor');
	}
	createConvolver() {
		return new FakeConvolver(this, 'convolver');
	}
	createBuffer(ch: number, len: number, sr: number) {
		return new FakeBuffer(ch, len, sr);
	}
	decodeAudioData(_ab: ArrayBuffer, ok: (b: FakeBuffer) => void) {
		const b = new FakeBuffer(1, 4800, this.sampleRate);
		ok(b);
		return Promise.resolve(b);
	}
	sources() {
		return this.nodes.filter((n): n is FakeSource => n instanceof FakeSource);
	}
}

const asCtx = (c: FakeContext) => c as unknown as BaseAudioContext;
const asNode = (n: FakeNode) => n as unknown as AudioNode;

function reaches(from: FakeNode, target: FakeNode): boolean {
	const seen = new Set<FakeNode>();
	const stack = [from];
	while (stack.length) {
		const n = stack.pop()!;
		if (n === target) return true;
		if (seen.has(n)) continue;
		seen.add(n);
		for (const o of n.outputs) if (o instanceof FakeNode) stack.push(o);
	}
	return false;
}

function paramsOf(n: FakeNode): FakeParam[] {
	return Object.values(n).filter((v): v is FakeParam => v instanceof FakeParam);
}

/** Render a voice into a fake context and check the invariants every voice must satisfy. */
function exerciseVoice(
	run: (ctx: BaseAudioContext, out: AudioNode, when: number) => number,
	label: string,
) {
	const ctx = new FakeContext();
	const out = ctx.createGain();
	const before = ctx.nodes.length;
	const when = 0.5;
	const dur = run(asCtx(ctx), asNode(out), when);

	expect(Number.isFinite(dur), `${label}: finite duration`).toBe(true);
	expect(dur, `${label}: positive duration`).toBeGreaterThan(0);

	const created = ctx.nodes.slice(before);
	const sources = created.filter((n): n is FakeSource => n instanceof FakeSource);
	expect(sources.length, `${label}: has sources`).toBeGreaterThan(0);
	for (const s of sources) {
		expect(s.started, `${label}: source started`).toBeGreaterThanOrEqual(when - 1e-9);
		expect(s.stopped, `${label}: source stop scheduled`).toBeDefined();
		expect(s.stopped!, `${label}: stops within reported duration`).toBeLessThanOrEqual(
			when + dur + 1e-6,
		);
		expect(s.onended, `${label}: cleanup hook`).toBeTypeOf('function');
	}
	expect(
		sources.some((s) => reaches(s, out)),
		`${label}: audible path to output`,
	).toBe(true);
	for (const n of created)
		for (const p of paramsOf(n))
			for (const e of p.events) {
				expect(e.time, `${label}: automation not before start`).toBeGreaterThanOrEqual(when - 1e-6);
				expect(e.time, `${label}: automation within duration`).toBeLessThanOrEqual(when + dur + 1e-6);
			}

	// No leaks: once every source has ended, every node the voice created is disconnected.
	for (const s of sources) s.end();
	for (const n of created) expect(n.outputs.size, `${label}: ${n.kind} disconnected`).toBe(0);
	expect(out.outputs.size).toBe(0);
	return { dur, sources };
}

// ---------------------------------------------------------------------------------------------

describe('voices', () => {
	it('has a voice for every sfx name', () => {
		for (const name of SFX_NAMES) expect(voices[name], name).toBeTypeOf('function');
		expect(Object.keys(voices).sort()).toEqual([...SFX_NAMES].sort());
	});

	it('index re-exports SFX_NAMES', () => {
		expect(INDEX_SFX_NAMES).toBe(SFX_NAMES);
	});

	for (const name of SFX_NAMES) {
		it(`${name}: schedules valid automation, stops in time and cleans up`, () => {
			for (const index of [undefined, 0, 1, 3, 5, 0.5]) {
				exerciseVoice((c, o, w) => voices[name](c, o, w, { index }), `${name}[${index}]`);
			}
		});
	}

	it('reelStop varies pitch and pan across reels', () => {
		const ctx = new FakeContext();
		const out = ctx.createGain();
		const pans: number[] = [];
		for (let reel = 0; reel < 5; reel++) {
			const before = ctx.nodes.length;
			voices.reelStop(asCtx(ctx), asNode(out), 0, { index: reel });
			const panner = ctx.nodes.slice(before).find((n): n is FakePanner => n instanceof FakePanner);
			pans.push(panner!.pan.value);
		}
		expect(pans[0]).toBeCloseTo(-0.4, 6);
		expect(pans[4]).toBeCloseTo(0.4, 6);
		for (let i = 1; i < 5; i++) expect(pans[i]).toBeGreaterThan(pans[i - 1]);
	});

	it('tiers escalate in length', () => {
		const lengths = (['tierBig', 'tierGrand', 'tierMega', 'tierLegendary', 'tierMax'] as SfxName[]).map(
			(n) => voices[n](asCtx(new FakeContext()), asNode(new FakeContext().createGain()), 0, {}),
		);
		for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
		expect(lengths[0]).toBeGreaterThanOrEqual(2);
		expect(lengths[4]).toBeLessThanOrEqual(4.5);
	});
});

describe('loop segments', () => {
	for (const name of LOOP_NAMES) {
		it(`${name}: every segment is valid and returns a positive period`, () => {
			for (const n of [0, 1, 7]) {
				let period = 0;
				exerciseVoice((c, o, w) => {
					const ctx = c;
					// Capture the period; report the segment's own sounding length for the invariants.
					const before = (ctx as unknown as FakeContext).nodes.length;
					period = loopSegments[name](c, o, w, { index: 0.5 }, n);
					const srcs = (ctx as unknown as FakeContext).nodes
						.slice(before)
						.filter((x): x is FakeSource => x instanceof FakeSource);
					return Math.max(...srcs.map((s) => s.stopped! - w));
				}, `${name}#${n}`);
				expect(period).toBeGreaterThan(0.005);
				expect(period).toBeLessThan(3);
			}
		});
	}
});

describe('music', () => {
	const startTimes = (ctx: FakeContext) =>
		ctx
			.sources()
			.map((s) => s.started!)
			.sort((a, b) => a - b);

	for (const track of ['base', 'private'] as const) {
		it(`${track}: renders 8 bars, deterministic`, () => {
			const a = new FakeContext();
			const b = new FakeContext();
			const da = renderMusic(asCtx(a), asNode(a.createGain()), track, 0.1, 8);
			const db = renderMusic(asCtx(b), asNode(b.createGain()), track, 0.1, 8);
			expect(da).toBeCloseTo((8 * 4 * 60) / MUSIC_TRACKS[track].bpm, 6);
			expect(db).toBe(da);
			expect(a.sources().length).toBeGreaterThan(50);
			expect(startTimes(a)).toEqual(startTimes(b));
		});

		it(`${track}: lookahead pumping matches a one-shot render exactly (no drift)`, () => {
			const a = new FakeContext();
			renderMusic(asCtx(a), asNode(a.createGain()), track, 0.1, 4);
			const b = new FakeContext();
			const seq = new MusicSequencer(asCtx(b), asNode(b.createGain()), track, 0.1);
			const end = 0.1 + (4 * 4 * 60) / MUSIC_TRACKS[track].bpm;
			for (let now = 0; now < end; now += 0.025) seq.pump(Math.min(now + 0.12, end - 1e-9), now);
			expect(startTimes(b).length).toBe(startTimes(a).length);
			startTimes(b).forEach((t, i) => expect(t).toBeCloseTo(startTimes(a)[i], 9));
		});

		it(`${track}: every music node cleans up`, () => {
			const ctx = new FakeContext();
			const out = ctx.createGain();
			const before = ctx.nodes.length;
			renderMusic(asCtx(ctx), asNode(out), track, 0, 2);
			const created = ctx.nodes.slice(before);
			for (const s of ctx.sources()) s.end();
			for (const n of created) expect(n.outputs.size, n.kind).toBe(0);
		});
	}

	it('tempos follow the brief', () => {
		expect(MUSIC_TRACKS.base.bpm).toBe(92);
		expect(MUSIC_TRACKS.private.bpm).toBe(100);
	});
});

// ---------------------------------------------------------------------------------------------

describe('engine (fake AudioContext)', () => {
	let ctx: FakeContext;
	let engine: AudioEngine;

	const masterGain = () =>
		ctx.nodes.find((n): n is FakeGain => n instanceof FakeGain && n.kind === 'gain' && reaches(n, ctx.destination) && [...n.outputs].some((o) => o instanceof FakeCompressor))!;

	beforeEach(() => {
		vi.useFakeTimers();
		ctx = new FakeContext();
		engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext, overrides: {} });
	});

	afterEach(() => {
		engine.dispose();
		vi.useRealTimers();
	});

	it('is silent and inert before unlock', () => {
		engine.play('winSmall');
		engine.loop('chipShower');
		vi.advanceTimersByTime(200);
		expect(ctx.nodes.length).toBe(1); // destination only
	});

	it('unlock builds sfx/music buses through master and a limiter, and resumes', async () => {
		await engine.unlock();
		await engine.unlock();
		expect(ctx.state).toBe('running');
		expect(ctx.nodes.filter((n) => n instanceof FakeCompressor).length).toBe(1);
		const comp = ctx.nodes.find((n) => n instanceof FakeCompressor)!;
		// limiter → makeup-compensation gain → destination
		const [unity] = [...comp.outputs] as FakeGain[];
		expect(unity).toBeInstanceOf(FakeGain);
		expect(unity.gain.value).toBeCloseTo(LIMITER.makeupCompensation, 9);
		expect(unity.outputs.has(ctx.destination)).toBe(true);
		expect(masterGain()).toBeDefined();
		// sfx and music buses feed master; music sits ~14 dB under
		const buses = ctx.nodes.filter(
			(n): n is FakeGain => n instanceof FakeGain && n.outputs.has(masterGain()) && n.outputs.size === 2,
		);
		expect(buses.map((b) => +(20 * Math.log10(b.gain.value)).toFixed(1)).sort((a, b) => a - b)).toEqual([-14, 0]);
	});

	it('plays one-shots and drops same-name repeats within 25 ms', async () => {
		await engine.unlock();
		const count = () => ctx.sources().length;
		const base = count();
		engine.play('winSmall');
		const one = count();
		expect(one).toBeGreaterThan(base);
		engine.play('winSmall');
		expect(count()).toBe(one);
		ctx.currentTime += 0.03;
		engine.play('winSmall');
		expect(count()).toBeGreaterThan(one);
	});

	it('lets reelStop / keyLand stack', async () => {
		await engine.unlock();
		engine.play('reelStop', { index: 0 });
		const one = ctx.sources().length;
		engine.play('reelStop', { index: 1 });
		expect(ctx.sources().length).toBeGreaterThan(one);
		const two = ctx.sources().length;
		engine.play('keyLand', { index: 1 });
		engine.play('keyLand', { index: 2 });
		expect(ctx.sources().length).toBeGreaterThan(two);
	});

	it('setVolume(0) ramps master to exactly 0 and drops one-shots', async () => {
		await engine.unlock();
		engine.setVolume(0);
		expect(masterGain().gain.final).toBe(0);
		const n = ctx.sources().length;
		engine.play('tierMax');
		expect(ctx.sources().length).toBe(n);
		engine.setVolume(1);
		expect(masterGain().gain.final).toBeGreaterThan(0.5);
	});

	it('setBusVolumes sets the music and effects buses independently', async () => {
		await engine.unlock();
		const master = masterGain();
		const buses = () =>
			ctx.nodes.filter((n): n is FakeGain => n instanceof FakeGain && n.kind === 'gain' && n !== master && [...n.outputs].includes(master));
		engine.setBusVolumes({ music: 0, sfx: 0.5 });
		const finals = buses().map((bus) => bus.gain.final).sort();
		expect(finals).toEqual([0, 0.25]);
	});

	it('remembers volume set before unlock', async () => {
		engine.setVolume(0);
		await engine.unlock();
		expect(masterGain().gain.final).toBe(0);
	});

	it('loops are idempotent and stop with a short fade', async () => {
		await engine.unlock();
		const tickFor = (seconds: number) => {
			for (let i = 0; i < seconds / 0.025; i++) {
				ctx.currentTime += 0.025;
				vi.advanceTimersByTime(25);
			}
		};
		engine.loop('chipShower');
		engine.loop('chipShower');
		tickFor(0.5);
		const n = ctx.sources().length;
		expect(n).toBeGreaterThan(0);
		tickFor(1);
		const perSecond = ctx.sources().length - n;
		// One running layer ≈ 18 clacks/s (each clack is a handful of sources) — not two layers.
		expect(perSecond).toBeGreaterThan(18 * 2);
		expect(perSecond).toBeLessThan(18 * 2 * 8);

		engine.stop('chipShower');
		const after = ctx.sources().length;
		tickFor(0.5);
		expect(ctx.sources().length).toBe(after);
	});

	it('stop() fades the loop layer over 120 ms', async () => {
		await engine.unlock();
		engine.loop('anticipation');
		ctx.currentTime = 0.5;
		const before = new Set(ctx.nodes);
		engine.stop('anticipation');
		const fades = ctx.nodes
			.filter((n): n is FakeGain => n instanceof FakeGain && before.has(n))
			.map((g) => g.gain.events)
			.filter((ev) => ev.length && ev[ev.length - 1].value === 0 && ev[ev.length - 1].type === 'linear');
		const fade = fades.find((ev) => Math.abs(ev[ev.length - 1].time - 0.62) < 1e-6);
		expect(fade).toBeDefined();
	});

	it('play(countTick) during a running countTick loop only updates pitch', async () => {
		await engine.unlock();
		engine.loop('countTick');
		vi.advanceTimersByTime(25);
		const n = ctx.sources().length;
		engine.play('countTick', { index: 0.9 });
		expect(ctx.sources().length).toBe(n);
		const oscs = () => ctx.sources().filter((s): s is FakeOsc => s instanceof FakeOsc);
		const low = Math.max(...oscs().map((o) => o.frequency.value));
		ctx.currentTime = 1;
		vi.advanceTimersByTime(25);
		const newOscs = oscs().slice(-3);
		expect(Math.max(...newOscs.map((o) => o.frequency.value))).toBeGreaterThan(low * 1.5);
	});

	it('music crossfades over 1.2 s and null fades out', async () => {
		engine.music('base'); // before unlock: remembered
		await engine.unlock();
		vi.advanceTimersByTime(25);
		const afterBase = ctx.sources().length;
		expect(afterBase).toBeGreaterThan(0);

		ctx.currentTime = 2;
		const before = new Set(ctx.nodes);
		engine.music('private');
		const ramps = ctx.nodes
			.filter((n): n is FakeGain => n instanceof FakeGain)
			.map((g) => ({ g, ev: g.gain.events[g.gain.events.length - 1] }))
			.filter(({ ev }) => ev && ev.type === 'linear' && Math.abs(ev.time - 3.2) < 1e-6);
		const fadeOut = ramps.find(({ g, ev }) => before.has(g) && ev.value === 0);
		const fadeIn = ramps.find(({ g, ev }) => !before.has(g) && ev.value === 1);
		expect(fadeOut).toBeDefined();
		expect(fadeIn).toBeDefined();

		engine.music('private'); // same track: no-op
		ctx.currentTime = 4;
		engine.music(null);
		const out = ctx.nodes
			.filter((n): n is FakeGain => n instanceof FakeGain)
			.map((g) => g.gain.events[g.gain.events.length - 1])
			.filter((ev) => ev && ev.type === 'linear' && ev.value === 0 && Math.abs(ev.time - 5.2) < 1e-6);
		expect(out.length).toBe(1);

		// After the fade, scheduling stops.
		ctx.currentTime = 7;
		vi.advanceTimersByTime(50);
		const settled = ctx.sources().length;
		ctx.currentTime = 9;
		vi.advanceTimersByTime(50);
		expect(ctx.sources().length).toBe(settled);
	});

	it('suspend/resume follow tab visibility', async () => {
		const listeners: Record<string, () => void> = {};
		const doc = {
			visibilityState: 'visible',
			addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
		};
		vi.stubGlobal('document', doc);
		try {
			await engine.unlock();
			await engine.unlock();
			doc.visibilityState = 'hidden';
			listeners.visibilitychange();
			await Promise.resolve();
			expect(ctx.suspendCalls).toBe(1);
			expect(ctx.state).toBe('suspended');
			doc.visibilityState = 'visible';
			listeners.visibilitychange();
			await Promise.resolve();
			expect(ctx.state).toBe('running');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('plays a decoded override file instead of the synth voice', async () => {
		engine.dispose();
		ctx = new FakeContext();
		const fetchMock = vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }));
		vi.stubGlobal('fetch', fetchMock);
		try {
			engine = new AudioEngine({
				createContext: () => ctx as unknown as AudioContext,
				overrides: { './override/chipLock.mp3': '/a/chipLock.mp3' },
			});
			await engine.unlock();
			expect(fetchMock).toHaveBeenCalledWith('/a/chipLock.mp3');
			for (let i = 0; i < 20; i++) await Promise.resolve(); // let fetch → decode settle
			const before = ctx.nodes.length;
			engine.play('chipLock');
			const created = ctx.nodes.slice(before);
			expect(created.some((n) => n instanceof FakeBufferSource && n.buffer !== null)).toBe(true);
			expect(created.some((n) => n instanceof FakeOsc)).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('audio singleton without WebAudio (node / SSR)', () => {
	it('every call is a safe no-op', async () => {
		expect(typeof (globalThis as { AudioContext?: unknown }).AudioContext).toBe('undefined');
		await expect(audio.unlock()).resolves.toBeUndefined();
		expect(() => {
			audio.play('reelStop', { index: 2 });
			audio.play('keyLand', { index: 4, volume: 0.5 });
			audio.loop('anticipation');
			audio.stop('anticipation');
			audio.stop('winGreat');
			audio.music('base');
			audio.music(null);
			audio.setVolume(0);
			audio.setVolume(0.7);
			audio.suspend();
			audio.resume();
		}).not.toThrow();
	});
});
