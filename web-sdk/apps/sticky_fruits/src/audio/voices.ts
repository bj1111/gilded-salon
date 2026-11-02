/**
 * Gilded Salon synth voices — every sound in the game, synthesized with the WebAudio API.
 *
 * Palette: vibraphone / celesta / bells (FM), Rhodes-like electric piano (FM 1:1), upright-bass
 * pluck, brushes, clay-chip clacks, soft brass swells, timpani. Key: D♭ major / B♭ minor.
 *
 * A voice is `(ctx, out, when, opts) => seconds`: it schedules its nodes at `when`, connects them
 * to `out`, and returns how long it sounds. All nodes of one voice live in a `Scope` that
 * disconnects them once every source has ended (no leaks). The shared room reverb lives on the
 * bus (see engine.ts), not in the voices.
 */
import { keyPitch, tickPitch, type LoopName, type PlayOptions, type SfxName } from './soundMap';

export type Voice = (ctx: BaseAudioContext, out: AudioNode, when: number, opts: PlayOptions) => number;
/** A loop layer is a chain of segments; each schedules itself at `when` and returns the time to the next one. */
export type LoopSegment = (
	ctx: BaseAudioContext,
	out: AudioNode,
	when: number,
	opts: PlayOptions,
	n: number,
) => number;

// ---- small utilities --------------------------------------------------------------------------

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** MIDI note → Hz. */
export const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** mulberry32 — small, fast, deterministic. */
export function prng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

let shared = prng(0x6a09e667);
/** Shared variation source for voices (deterministic sequence, varied per call). */
export const rand = () => shared();
export const reseed = (seed: number) => {
	shared = prng(seed);
};

type Dest = AudioNode | AudioParam;
// AudioNode.connect is overloaded for nodes and params; one runtime call handles both.
const link = (src: AudioNode, dest: Dest) => {
	src.connect(dest as AudioNode);
};

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
	let buf = noiseCache.get(ctx);
	if (!buf) {
		const len = Math.floor(ctx.sampleRate * 2);
		buf = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = buf.getChannelData(0);
		const r = prng(0x51ed270b);
		for (let i = 0; i < len; i++) data[i] = r() * 2 - 1;
		noiseCache.set(ctx, buf);
	}
	return buf;
}

// ---- Scope: owns the nodes of one voice and frees them when its sources have ended ------------

export class Scope {
	private nodes: AudioNode[] = [];
	private live = 0;
	end: number;

	constructor(
		readonly ctx: BaseAudioContext,
		readonly t0: number,
	) {
		this.end = t0;
	}

	get duration() {
		return this.end - this.t0;
	}

	private keep<T extends AudioNode>(node: T, dest?: Dest): T {
		this.nodes.push(node);
		if (dest) link(node, dest);
		return node;
	}

	gain(value: number, dest?: Dest): GainNode {
		const g = this.ctx.createGain();
		g.gain.value = value;
		return this.keep(g, dest);
	}

	filter(type: BiquadFilterType, freq: number, q: number, dest?: Dest): BiquadFilterNode {
		const f = this.ctx.createBiquadFilter();
		f.type = type;
		f.frequency.value = freq;
		f.Q.value = q;
		return this.keep(f, dest);
	}

	/** A stereo panner (null where StereoPannerNode is missing, e.g. old Safari). */
	panner(p: number, dest: AudioNode): StereoPannerNode | null {
		if (typeof this.ctx.createStereoPanner !== 'function') return null;
		const n = this.ctx.createStereoPanner();
		n.pan.value = clamp(p, -1, 1);
		return this.keep(n, dest);
	}

	/** Stereo position; degrades to a pass-through where panning is unavailable. */
	pan(p: number, dest: AudioNode): AudioNode {
		return this.panner(p, dest) ?? dest;
	}

	osc(type: OscillatorType, freq: number, start: number, stop: number, dest?: Dest): OscillatorNode {
		const o = this.ctx.createOscillator();
		o.type = type;
		o.frequency.value = freq;
		this.keep(o, dest);
		this.run(o, start, stop);
		return o;
	}

	noise(start: number, stop: number, dest?: Dest): AudioBufferSourceNode {
		const s = this.ctx.createBufferSource();
		s.buffer = noiseBuffer(this.ctx);
		s.loop = true;
		this.keep(s, dest);
		this.run(s, start, stop, rand() * 1.5);
		return s;
	}

	private run(src: AudioScheduledSourceNode, start: number, stop: number, offset?: number) {
		this.live++;
		src.onended = () => {
			if (--this.live <= 0) this.dispose();
		};
		if (offset !== undefined) (src as AudioBufferSourceNode).start(start, offset);
		else src.start(start);
		src.stop(stop);
		if (stop > this.end) this.end = stop;
	}

	dispose() {
		for (const n of this.nodes) {
			try {
				n.disconnect();
			} catch {
				/* already disconnected */
			}
		}
		this.nodes = [];
	}
}

// ---- envelopes ----------------------------------------------------------------------------------

/**
 * Attack → natural exponential decay (time constant `tau`) → release starting at `end`.
 * Uses only explicit-value ramps (no setTarget) so every segment is well defined. Returns the
 * time the param reaches 0.
 */
export function shape(
	p: AudioParam,
	t: number,
	peak: number,
	attack: number,
	tau: number,
	end: number,
	release: number,
): number {
	const top = t + attack;
	const hold = Math.max(end, top);
	p.setValueAtTime(0, t);
	if (peak <= 0) return hold + release;
	p.linearRampToValueAtTime(peak, top);
	if (hold > top + 1e-4) p.exponentialRampToValueAtTime(Math.max(1e-6, peak * Math.exp(-(hold - top) / tau)), hold);
	p.linearRampToValueAtTime(0, hold + release);
	return hold + release;
}

/** Percussive: attack, then decay to −60 dB over `decay` seconds. */
export const perc = (p: AudioParam, t: number, peak: number, attack: number, decay: number) =>
	shape(p, t, peak, attack, decay / 6.9, t + attack + decay, 0.004);

/** Linear swell: attack, hold, release. Returns the end time. */
export function swell(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number) {
	p.setValueAtTime(0, t);
	p.linearRampToValueAtTime(peak, t + attack);
	p.linearRampToValueAtTime(peak, t + attack + hold);
	p.linearRampToValueAtTime(0, t + attack + hold + release);
	return t + attack + hold + release;
}

// ---- instruments ----------------------------------------------------------------------------------

type MalletOpts = {
	ratio: number;
	index: number;
	indexDecay: number;
	decay: number;
	attack?: number;
	tremolo?: number;
	tremDepth?: number;
	partial?: number;
	partialGain?: number;
	partialDecay?: number;
	pan?: number;
};

/** FM mallet core: sine carrier, sine modulator at `ratio`, decaying index, optional tremolo. */
function mallet(s: Scope, dest: AudioNode, t: number, f: number, vel: number, o: MalletOpts): number {
	const attack = o.attack ?? 0.0015;
	const end = t + attack + o.decay + 0.01;
	let target: AudioNode = s.pan(o.pan ?? 0, dest);
	if (o.tremolo) {
		const depth = o.tremDepth ?? 0.12;
		const trem = s.gain(1 - depth, target);
		const lfo = s.osc('sine', o.tremolo, t, end);
		link(lfo, s.gain(depth, trem.gain));
		target = trem;
	}
	const amp = s.gain(0, target);
	perc(amp.gain, t, vel, attack, o.decay);
	const car = s.osc('sine', f, t, end, amp);
	const mod = s.osc('sine', f * o.ratio, t, end);
	const dev = s.gain(0, car.frequency);
	link(mod, dev);
	perc(dev.gain, t, o.index * f * o.ratio, 0.001, Math.min(o.indexDecay, o.decay));
	if (o.partial) {
		const pg = s.gain(0, target);
		perc(pg.gain, t, vel * (o.partialGain ?? 0.2), 0.001, Math.min(o.partialDecay ?? o.decay * 0.3, o.decay));
		s.osc('sine', f * o.partial, t, end, pg);
	}
	return end;
}

export const vibes = (s: Scope, dest: AudioNode, t: number, f: number, vel: number, pan = 0, decay = 1.8) =>
	mallet(s, dest, t, f, vel, {
		ratio: 4,
		index: 0.9,
		indexDecay: 0.3,
		decay,
		tremolo: 5.4,
		tremDepth: 0.16,
		partial: 4,
		partialGain: 0.1,
		partialDecay: 0.3,
		pan,
	});

export const celesta = (s: Scope, dest: AudioNode, t: number, f: number, vel: number, pan = 0, decay = 1.2) =>
	mallet(s, dest, t, f, vel, {
		ratio: 4,
		index: 1.5,
		indexDecay: 0.12,
		decay,
		tremolo: 6.5,
		tremDepth: 0.05,
		partial: 2,
		partialGain: 0.2,
		partialDecay: 0.5,
		pan,
	});

export const bell = (s: Scope, dest: AudioNode, t: number, f: number, vel: number, pan = 0, decay = 2.4) =>
	mallet(s, dest, t, f, vel, {
		ratio: 3.5,
		index: 1.6,
		indexDecay: 0.45,
		decay,
		tremolo: 4.2,
		tremDepth: 0.06,
		partial: 2.76,
		partialGain: 0.12,
		partialDecay: 0.7,
		pan,
	});

/** Rhodes-like electric piano: FM 1:1 with a decaying index plus a quiet octave sine. */
export function rhodes(s: Scope, dest: AudioNode, t: number, f: number, vel: number, dur: number, pan = 0) {
	const out = s.pan(pan, dest);
	const amp = s.gain(0, out);
	const end = shape(amp.gain, t, vel, 0.004, 1.2, t + dur, 0.14) + 0.005;
	const car = s.osc('sine', f, t, end, amp);
	const mod = s.osc('sine', f, t, end);
	const dev = s.gain(0, car.frequency);
	link(mod, dev);
	shape(dev.gain, t, f * (0.6 + 1.6 * vel), 0.002, 0.28, t + dur, 0.1);
	const oct = s.gain(0, out);
	shape(oct.gain, t, vel * 0.12, 0.004, 0.45, t + dur, 0.1);
	s.osc('sine', f * 2, t, end, oct);
	return end;
}

/** Upright-bass pluck: sine fundamental + triangle through a closing lowpass + finger noise. */
export function upright(s: Scope, dest: AudioNode, t: number, f: number, vel: number, dur: number) {
	const amp = s.gain(0, dest);
	const end = shape(amp.gain, t, vel * 0.6, 0.007, 0.5, t + dur, 0.06) + 0.005;
	s.osc('sine', f, t, end, amp);
	const lp = s.filter('lowpass', f * 8, 1.1, dest);
	lp.frequency.setValueAtTime(f * 9, t);
	lp.frequency.exponentialRampToValueAtTime(f * 2.5, t + 0.16);
	const body = s.gain(0, lp);
	shape(body.gain, t, vel * 0.45, 0.005, 0.32, t + dur, 0.05);
	s.osc('triangle', f, t, end, body);
	noiseHit(s, dest, t, 'lowpass', 900, 0.7, vel * 0.25, 0.001, 0.03);
	return end;
}

/** Filtered noise burst, optionally sweeping the filter. Returns the end time. */
export function noiseHit(
	s: Scope,
	dest: AudioNode,
	t: number,
	type: BiquadFilterType,
	freq: number,
	q: number,
	peak: number,
	attack: number,
	decay: number,
	sweepTo?: number,
) {
	const f = s.filter(type, freq, q, dest);
	if (sweepTo) {
		f.frequency.setValueAtTime(freq, t);
		f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
	}
	const g = s.gain(0, f);
	const end = perc(g.gain, t, peak, attack, decay) + 0.003;
	s.noise(t, end, g);
	return end;
}

/** Clay chip clack: two short bandpassed bursts (~2.5 kHz, ~4 kHz), a body knock and a tiny ping. */
export function chipClack(s: Scope, dest: AudioNode, t: number, vel: number, pitch = 1, pan = 0) {
	const out = s.pan(pan, dest);
	let end = noiseHit(s, out, t, 'bandpass', 2500 * pitch, 4.5, vel * 2.6, 0.0006, 0.03);
	end = Math.max(end, noiseHit(s, out, t + 0.0055, 'bandpass', 4000 * pitch, 5, vel * 2.1, 0.0005, 0.024));
	end = Math.max(end, noiseHit(s, out, t, 'bandpass', 1150 * pitch, 1.6, vel * 0.9, 0.0008, 0.028));
	const pg = s.gain(0, out);
	const pe = perc(pg.gain, t, vel * 0.09, 0.0008, 0.09) + 0.003;
	s.osc('sine', 3100 * pitch, t, pe, pg);
	return Math.max(end, pe);
}

/** Sine with a downward pitch drop — thuds, thocks, kicks. */
export function thud(s: Scope, dest: AudioNode, t: number, f0: number, f1: number, decay: number, vel: number) {
	const g = s.gain(0, dest);
	const end = perc(g.gain, t, vel, 0.002, decay) + 0.003;
	const o = s.osc('sine', f0, t, end, g);
	o.frequency.setValueAtTime(f0, t);
	o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.8);
	return end;
}

/** Soft brass: detuned sawtooth pair through an enveloped lowpass, delayed vibrato. */
export function brass(
	s: Scope,
	dest: AudioNode,
	t: number,
	f: number,
	vel: number,
	dur: number,
	bright = 1,
	pan = 0,
) {
	const attack = Math.min(0.3, dur * 0.5);
	const release = 0.45;
	const end = t + dur + release + 0.01;
	const out = s.pan(pan, dest);
	const fc = Math.min(9000, f * (2 + 1.5 * bright));
	const lp = s.filter('lowpass', fc, 0.8, out);
	lp.frequency.setValueAtTime(Math.max(60, f * 0.9), t);
	lp.frequency.exponentialRampToValueAtTime(fc, t + attack * 1.2);
	lp.frequency.exponentialRampToValueAtTime(fc * 0.72, t + dur);
	lp.frequency.exponentialRampToValueAtTime(Math.max(60, f * 0.8), t + dur + release);
	const amp = s.gain(0, lp);
	amp.gain.setValueAtTime(0, t);
	amp.gain.linearRampToValueAtTime(vel, t + attack);
	amp.gain.linearRampToValueAtTime(vel * 0.78, t + dur);
	amp.gain.linearRampToValueAtTime(0, t + dur + release);
	const lfo = s.osc('sine', 5.1, t, end);
	const vib = s.gain(0);
	link(lfo, vib);
	vib.gain.setValueAtTime(0, t);
	vib.gain.linearRampToValueAtTime(0, t + Math.min(0.35, dur * 0.4));
	vib.gain.linearRampToValueAtTime(f * 0.004, t + Math.min(0.9, dur));
	for (const cents of [-6, 7]) {
		const o = s.osc('sawtooth', f * 2 ** (cents / 1200), t, end, amp);
		link(vib, o.frequency);
	}
	return end;
}

/** One timpani stroke: pitched sine (with a brief pitch glide) + a mallet thump. */
function timpani(s: Scope, dest: AudioNode, t: number, f: number, vel: number, decay: number) {
	const g = s.gain(0, dest);
	const end = perc(g.gain, t, vel, 0.004, decay) + 0.003;
	const o = s.osc('sine', f * 1.04, t, end, g);
	o.frequency.setValueAtTime(f * 1.04, t);
	o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
	const g2 = s.gain(0, dest);
	perc(g2.gain, t, vel * 0.35, 0.004, decay * 0.45);
	s.osc('sine', f * 1.51, t, end, g2);
	return Math.max(end, noiseHit(s, dest, t, 'lowpass', 380, 0.8, vel * 0.9, 0.002, 0.07));
}

/** Timpani roll with a crescendo from v0 to v1. */
function timpaniRoll(s: Scope, dest: AudioNode, t: number, f: number, dur: number, v0: number, v1: number) {
	const rate = 15;
	const n = Math.floor(dur * rate);
	let end = t;
	for (let i = 0; i < n; i++) {
		const ti = t + i / rate + (i ? (rand() - 0.5) * 0.01 : 0);
		const v = v0 + (v1 - v0) * (i / n) ** 1.6;
		end = Math.max(end, timpani(s, dest, ti, f, v, 0.32));
	}
	return end;
}

/** Sustained pad: detuned saws + sub triangle through a soft lowpass, slow attack/release. */
export function pad(
	s: Scope,
	dest: AudioNode,
	t: number,
	f: number,
	vel: number,
	dur: number,
	attack: number,
	release: number,
	cutoff = 900,
	pan = 0,
) {
	const end = t + dur + release + 0.01;
	const out = s.pan(pan, dest);
	const lp = s.filter('lowpass', cutoff, 0.4, out);
	const amp = s.gain(0, lp);
	amp.gain.setValueAtTime(0, t);
	amp.gain.linearRampToValueAtTime(vel, t + attack);
	amp.gain.linearRampToValueAtTime(vel, t + Math.max(attack, dur));
	amp.gain.linearRampToValueAtTime(0, t + Math.max(attack, dur) + release);
	s.osc('sawtooth', f * 2 ** (-5 / 1200), t, end, amp);
	s.osc('sawtooth', f * 2 ** (5 / 1200), t, end, amp);
	const sub = s.gain(0.8, amp);
	s.osc('triangle', f, t, end, sub);
	return end;
}

/** High sparkle: a few soft partials with independent tremolo, spread in stereo. */
function shimmer(s: Scope, dest: AudioNode, t: number, f: number, dur: number, vel: number) {
	const parts: [number, number, number][] = [
		[1, 7.1, -0.5],
		[1.5, 9.3, 0.5],
		[2, 11.7, 0],
	];
	let end = t;
	for (const [mult, rate, pan] of parts) {
		const out = s.pan(pan, dest);
		const trem = s.gain(0.6, out);
		const e = t + 0.08 + dur + 0.01;
		link(s.osc('sine', rate, t, e), s.gain(0.4, trem.gain));
		const amp = s.gain(0, trem);
		perc(amp.gain, t, vel, 0.08, dur);
		s.osc('sine', f * mult, t, e, amp);
		end = Math.max(end, e);
	}
	return end;
}

/** Brushed swish: bandpassed noise with a soft swell, optionally sweeping. */
export function brush(s: Scope, dest: AudioNode, t: number, dur: number, vel: number, freq = 3200, pan = 0) {
	const out = s.pan(pan, dest);
	const f = s.filter('bandpass', freq, 0.8, out);
	f.frequency.setValueAtTime(freq * 0.8, t);
	f.frequency.linearRampToValueAtTime(freq * 1.2, t + dur);
	const g = s.gain(0, f);
	const end = swell(g.gain, t, vel, dur * 0.55, 0, dur * 0.45) + 0.003;
	s.noise(t, end, g);
	return end;
}

/** Soft ride cymbal: a few inharmonic partials + airy highpassed noise. */
export function ride(s: Scope, dest: AudioNode, t: number, vel: number, pan = 0.35) {
	const out = s.pan(pan, dest);
	const hp = s.filter('highpass', 2800, 0.7, out);
	let end = t;
	for (const [freq, g] of [
		[3135, 0.22],
		[4422, 0.16],
		[5871, 0.12],
		[7350, 0.08],
	] as const) {
		const amp = s.gain(0, hp);
		const e = perc(amp.gain, t, vel * g, 0.001, 0.75) + 0.003;
		s.osc('square', freq, t, e, amp);
		end = Math.max(end, e);
	}
	return Math.max(end, noiseHit(s, out, t, 'highpass', 6500, 0.6, vel * 0.5, 0.001, 0.45));
}

// ---- room reverb (procedural impulse response) -----------------------------------------------------

/** Stereo IR: pre-delay, a few early reflections, then darkening decaying noise (−60 dB at `seconds`). */
export function makeRoomIR(ctx: BaseAudioContext, seconds = 1.6): AudioBuffer {
	const sr = ctx.sampleRate;
	const len = Math.max(1, Math.floor(sr * seconds));
	const ir = ctx.createBuffer(2, len, sr);
	const pre = Math.floor(sr * 0.012);
	const early = [0.019, 0.027, 0.041, 0.053].map((x) => Math.floor(sr * x));
	for (let ch = 0; ch < 2; ch++) {
		const d = ir.getChannelData(ch);
		const r = prng(0x2545f491 + ch * 7919);
		let lp = 0;
		for (let i = pre; i < len; i++) {
			const t = (i - pre) / sr;
			const fc = 1400 + 8000 * Math.exp(-t * 2.2); // brighter early, darker tail
			const a = Math.exp((-2 * Math.PI * fc) / sr);
			lp = (1 - a) * (r() * 2 - 1) + a * lp;
			const fadeIn = Math.min(1, t / 0.006);
			d[i] = lp * Math.exp((-6.9 * t) / seconds) * fadeIn;
		}
		early.forEach((e, k) => {
			const at = e + (ch ? 37 : 0) * (k % 2 ? 1 : -1);
			if (at > 0 && at < len) d[at] += (ch === k % 2 ? 0.5 : 0.35) * 0.8 ** k;
		});
	}
	return ir;
}

// ---- the voices --------------------------------------------------------------------------------------

/** Wrap a builder as a Voice; `trimDb` is the voice's output trim used to balance the mix. */
const voice =
	(build: (s: Scope, t: number, out: AudioNode, o: PlayOptions) => void, trimDb = 0): Voice =>
	(ctx, out, when, opts) => {
		const s = new Scope(ctx, when);
		build(s, when, trimDb ? s.gain(10 ** (trimDb / 20), out) : out, opts ?? {});
		return s.duration;
	};

// Notes (MIDI)
const Db2 = 37,
	Ab1 = 32,
	Eb2 = 39,
	Ab2 = 44,
	Db3 = 49;
const Db5 = 73,
	F5 = 77,
	Ab5 = 80,
	Bb5 = 82,
	C6 = 84,
	Db6 = 85,
	Eb6 = 87,
	F6 = 89,
	Ab6 = 92,
	Db7 = 97;

// Rootless voicings shared with the music.
export const VOICING = {
	Dbmaj9: [53, 56, 60, 63], // F A♭ C E♭
	Bbm9: [53, 56, 60, 61], // F A♭ C D♭
	Ebm9: [54, 58, 61, 65], // G♭ B♭ D♭ F
	Ab13: [54, 58, 60, 65], // G♭ B♭ C F
} as const;

function strum(s: Scope, t: number, notes: readonly number[], gap: number, play: (t: number, f: number, i: number) => void) {
	notes.forEach((m, i) => play(t + i * gap, mtof(m), i));
}

// -- anticipation: tremolo pad on the dominant pedal + looping noise riser + soft heartbeat
const ANT_PERIOD = 2;
const ANT_XFADE = 0.25;
// Frequencies quantized to whole cycles per period, so overlapping segments stay phase-coherent
// and their linear crossfade sums to a constant level (seamless loop).
const qf = (f: number) => Math.round(f * ANT_PERIOD) / ANT_PERIOD;

function anticipationLayer(ctx: BaseAudioContext, out: AudioNode, t: number): Scope {
	const s = new Scope(ctx, t);
	out = s.gain(0.67, out); // trim (−3.5 dB)
	const end = t + ANT_PERIOD + ANT_XFADE;
	const trem = s.gain(0.7, out);
	link(s.osc('sine', 6, t, end), s.gain(0.3, trem.gain));
	const amp = s.gain(0, trem);
	amp.gain.setValueAtTime(0, t);
	amp.gain.linearRampToValueAtTime(1, t + ANT_XFADE);
	amp.gain.linearRampToValueAtTime(1, t + ANT_PERIOD);
	amp.gain.linearRampToValueAtTime(0, end);
	const lp = s.filter('lowpass', 650, 0.5, amp);
	for (const [m, type, g] of [
		[Ab2, 'triangle', 0.22],
		[51, 'triangle', 0.13], // E♭3
		[56, 'sine', 0.09], // A♭3
		[57, 'sine', 0.03], // A3 — the ♭9 rub that makes it tense
	] as const) {
		s.osc(type, qf(mtof(m)), t, end, s.gain(g, lp));
	}
	// riser
	const bp = s.filter('bandpass', 350, 3.2, out);
	bp.frequency.setValueAtTime(350, t);
	bp.frequency.exponentialRampToValueAtTime(2600, t + ANT_PERIOD);
	const rg = s.gain(0, bp);
	rg.gain.setValueAtTime(0, t);
	rg.gain.linearRampToValueAtTime(0.45, t + ANT_PERIOD - 0.14);
	rg.gain.linearRampToValueAtTime(0, t + ANT_PERIOD + 0.02);
	s.noise(t, t + ANT_PERIOD + 0.03, rg);
	// heartbeat
	thud(s, out, t, 64, 46, 0.22, 0.28);
	thud(s, out, t + 0.28, 60, 44, 0.2, 0.18);
	return s;
}

// -- count-up tick: wooden "tok" whose pitch follows the counter progress
const TICK_RATE = 14;
function tick(s: Scope, out: AudioNode, t: number, pitch: number, vel: number) {
	noiseHit(s, out, t, 'bandpass', 2300 * pitch, 3, vel * 1.6, 0.0005, 0.016);
	const g = s.gain(0, out);
	const e = perc(g.gain, t, vel * 0.32, 0.0005, 0.028) + 0.003;
	s.osc('sine', 1400 * pitch, t, e, g);
}

// -- chip shower: Poisson-scattered clacks on felt
const CHIP_RATE = 18;
const chipInterval = () => clamp(-Math.log(1 - rand()) / CHIP_RATE, 0.012, 0.25);
function scatteredChip(s: Scope, out: AudioNode, t: number) {
	chipClack(s, out, t, 0.28 + rand() * 0.4, 0.82 + rand() * 0.42, (rand() * 2 - 1) * 0.7);
}

// -- tier stingers: brass swell + bells, each tier brighter / longer
const TIER_TRIM_DB = [-2, -2.5, -2, -1.5, -1];

function tierStinger(level: 0 | 1 | 2 | 3 | 4) {
	return voice((s, t0, out) => {
		const bright = 0.7 + 0.35 * level;
		let t = t0;
		if (level === 4) {
			// Max: timpani roll on the dominant pedal, crescendo, cymbal-like swell into the hit.
			timpaniRoll(s, out, t, mtof(Ab1 + 12), 1.3, 0.08, 0.42);
			const hp = s.filter('highpass', 5000, 0.6, out);
			const cg = s.gain(0, hp);
			cg.gain.setValueAtTime(0, t + 0.6);
			cg.gain.linearRampToValueAtTime(0.32, t + 1.33);
			cg.gain.linearRampToValueAtTime(0.0, t + 2.6);
			s.noise(t + 0.6, t + 2.62, cg);
			t += 1.35;
			timpani(s, out, t, mtof(Db2 + 12), 0.6, 1.4);
		}
		// pickup chords
		if (level >= 2) {
			for (const m of VOICING.Ebm9) brass(s, out, t, mtof(m), 0.07, 0.28, bright * 0.8, (m - 58) / 20);
			t += 0.3;
		}
		if (level >= 1) {
			for (const m of VOICING.Ab13) brass(s, out, t, mtof(m), 0.08, 0.28, bright * 0.85, (m - 58) / 20);
			upright(s, out, t, mtof(Ab1 + 12), 0.5, 0.3);
			t += 0.3;
		}
		// the arrival chord: D♭ major (9) — wider and higher per tier
		const hold = [1.0, 1.15, 1.3, 1.4, 1.5][level];
		const chord = [
			[56, 61, 65],
			[56, 60, 61, 65],
			[53, 56, 60, 63, 68],
			[53, 56, 60, 63, 68, 72],
			[49, 53, 56, 60, 63, 68, 72],
		][level];
		const v = 0.32 / Math.sqrt(chord.length);
		for (const m of chord) brass(s, out, t, mtof(m), v, hold, bright, (m - 60) / 24);
		upright(s, out, t, mtof(Db2), 0.75, 0.9);
		// bells
		const bells = [
			[Db5, F5, Ab5],
			[Db5, F5, Ab5, C6],
			[Db5, F5, Ab5, C6, Db6],
			[Db5, F5, Ab5, C6, Db6, F6],
			[Db5, F5, Ab5, C6, Db6, F6, Ab6, Db7],
		][level];
		const gap = [0.03, 0.03, 0.065, 0.065, 0.05][level];
		const ring = [1.9, 2.1, 2.3, 2.4, 1.7][level];
		strum(s, t + 0.04, bells, gap, (tt, f, i) => bell(s, out, tt, f, 0.16, (i / bells.length - 0.5) * 0.8, ring));
		if (level >= 2) shimmer(s, out, t + 0.25, mtof(Db6), 0.9 + 0.2 * level, 0.025 + 0.006 * level);
		if (level >= 3) {
			// descending celesta cascade after the arrival
			const down = level === 4 ? [Db7, Ab6, F6, Db6, Ab5, F5] : [Ab6, F6, Db6, Ab5];
			strum(s, t + 0.55, down, 0.085, (tt, f, i) => celesta(s, out, tt, f, 0.13, i % 2 ? 0.4 : -0.4, 0.9));
		}
		if (level >= 1) for (let i = 0; i < level * 2; i++) scatteredChip(s, out, t + 0.05 + rand() * 0.6);
	}, TIER_TRIM_DB[level]);
}

export const voices: Record<SfxName, Voice> = {
	uiClick: voice((s, t, out) => {
		noiseHit(s, out, t, 'bandpass', 1500, 1.4, 1.5, 0.001, 0.025);
		const g = s.gain(0, out);
		s.osc('sine', 2400, t, perc(g.gain, t, 0.1, 0.0005, 0.014) + 0.003, g);
	}, 8),

	spinPress: voice((s, t, out) => {
		chipClack(s, out, t, 0.75, 0.8);
		thud(s, out, t, 96, 52, 0.17, 0.75);
		noiseHit(s, out, t, 'lowpass', 600, 0.7, 0.35, 0.002, 0.06);
	}, 1.5),

	reelStart: voice((s, t, out) => {
		const f = s.filter('bandpass', 500, 0.9, out);
		f.frequency.setValueAtTime(500, t);
		f.frequency.exponentialRampToValueAtTime(3800, t + 0.26);
		const g = s.gain(0, f);
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(1.1, t + 0.17);
		g.gain.linearRampToValueAtTime(0, t + 0.27);
		s.noise(t, t + 0.28, g);
		brush(s, out, t + 0.02, 0.22, 0.25, 6000, 0.2);
	}, -1.5),

	reelStop: voice((s, t, out, o) => {
		const reel = clamp(Math.round(o.index ?? 2), 0, 4);
		const k = 1 + (reel - 2) * 0.015; // ±3 % across the reels
		const p = s.pan(-0.4 + 0.2 * reel, out);
		thud(s, p, t, 110 * k, 70 * k, 0.09, 0.4);
		noiseHit(s, p, t, 'bandpass', 820 * k, 2.4, 2.4, 0.001, 0.05);
		const g = s.gain(0, p);
		s.osc('triangle', 220 * k, t, perc(g.gain, t, 0.32, 0.001, 0.06) + 0.003, g);
		noiseHit(s, p, t, 'highpass', 3200, 0.7, 0.2, 0.0005, 0.008);
	}, 2.5),

	wildLand: voice((s, t, out) => {
		chipClack(s, out, t, 0.75, 1);
		bell(s, out, t + 0.012, mtof(Db6), 0.3, 0.1, 1.8);
		vibes(s, out, t + 0.012, mtof(Db5), 0.14, -0.1, 1.2);
	}, 4),

	keyLand: voice((s, t, out, o) => {
		const f = mtof(Ab5) * keyPitch(o.index ?? 1);
		celesta(s, out, t, f, 0.4, 0, 1.4);
		celesta(s, out, t + 0.035, f * 2, 0.09, 0.3, 0.8);
		shimmer(s, out, t + 0.05, f * 2, 1.1, 0.025);
	}, 3),

	anticipation: (ctx, out, when) => anticipationLayer(ctx, out, when).duration,

	lineTrace: voice((s, t, out) => {
		strum(s, t, [Db5, F5, Ab5], 0.065, (tt, f, i) => vibes(s, out, tt, f, 0.2 + 0.03 * i, -0.3 + 0.3 * i, 0.9));
	}, 1),

	winSmall: voice((s, t, out) => {
		strum(s, t, [Db5, F5], 0.12, (tt, f, i) => vibes(s, out, tt, f, 0.32, i ? 0.2 : -0.2, 1.3));
	}, 2),

	winNice: voice((s, t, out) => {
		strum(s, t, [Db5, F5, Ab5], 0.1, (tt, f, i) => vibes(s, out, tt, f, 0.3, -0.3 + 0.3 * i, 1.4));
		upright(s, out, t, mtof(Db2 + 12), 0.4, 0.5);
	}, -1.5),

	winGreat: voice((s, t, out) => {
		strum(s, t, [Db5, F5, Ab5, C6, Eb6], 0.085, (tt, f, i) => vibes(s, out, tt, f, 0.27, -0.4 + 0.2 * i, 1.6));
		for (const m of VOICING.Dbmaj9) rhodes(s, out, t, mtof(m), 0.12, 0.9, (m - 58) / 15);
		upright(s, out, t, mtof(Db2), 0.6, 0.8);
		shimmer(s, out, t + 0.35, mtof(Db6), 1.2, 0.03);
	}, -2),

	countTick: voice((s, t, out, o) => tick(s, out, t, tickPitch(o.index ?? 0), 0.7)),

	countEnd: voice((s, t, out) => {
		strum(s, t, [Db5, F5, Ab5, C6], 0.014, (tt, f, i) => bell(s, out, tt, f, 0.15, -0.3 + 0.2 * i, 2.2));
		for (const m of VOICING.Dbmaj9) rhodes(s, out, t, mtof(m), 0.11, 1.1, (m - 58) / 15);
		upright(s, out, t, mtof(Db2), 0.6, 0.9);
	}, -2.5),

	tierBig: tierStinger(0),
	tierGrand: tierStinger(1),
	tierMega: tierStinger(2),
	tierLegendary: tierStinger(3),
	tierMax: tierStinger(4),

	chipShower: voice((s, t, out) => {
		for (let tt = t; tt < t + 1.9; tt += chipInterval()) scatteredChip(s, out, tt);
	}, 5),

	freeSpinsIntro: voice((s, t, out) => {
		const chords: [readonly number[], number, number][] = [
			[VOICING.Ebm9, Eb2, Bb5],
			[VOICING.Ab13, Ab1 + 12, C6],
			[[...VOICING.Dbmaj9, 65, 68], Db2, Db6],
		];
		chords.forEach(([notes, root, top], i) => {
			const tt = t + i * 0.42;
			const last = i === chords.length - 1;
			for (const m of notes) rhodes(s, out, tt, mtof(m), last ? 0.11 : 0.13, last ? 1.3 : 0.36, (m - 60) / 16);
			upright(s, out, tt, mtof(root), 0.6, last ? 1.0 : 0.36);
			bell(s, out, tt, mtof(top), 0.22, 0, last ? 2.0 : 1.0);
		});
		strum(s, t + 0.95, [Db5, F5, Ab5, C6, Db6], 0.07, (tt, f, i) => celesta(s, out, tt, f, 0.12, -0.4 + 0.2 * i, 1.1));
		shimmer(s, out, t + 1.0, mtof(Db6), 1.2, 0.025);
	}, -2),

	chipLock: voice((s, t, out) => {
		chipClack(s, out, t, 1, 0.84);
		chipClack(s, out, t + 0.045, 0.3, 0.9, 0.1);
		thud(s, out, t, 140, 88, 0.09, 0.42);
		noiseHit(s, out, t, 'bandpass', 420, 1.5, 0.7, 0.001, 0.06);
		for (const [f, g] of [
			[3100, 0.07],
			[4650, 0.045],
		] as const) {
			const a = s.gain(0, out);
			s.osc('sine', f, t, perc(a.gain, t, g, 0.001, 0.35) + 0.003, a);
		}
	}),

	retrigger: voice((s, t, out) => {
		strum(s, t, [Db6, F6, Ab6, Db7], 0.095, (tt, f, i) => bell(s, out, tt, f, 0.2, -0.3 + 0.2 * i, 1.3));
		shimmer(s, out, t + 0.3, mtof(Db7) / 2, 1.0, 0.03);
	}, 5.5),

	bonusEnd: voice((s, t, out) => {
		for (const m of VOICING.Ab13) rhodes(s, out, t, mtof(m), 0.13, 0.55, (m - 60) / 16);
		upright(s, out, t, mtof(Ab1 + 12), 0.6, 0.55);
		const t2 = t + 0.6;
		for (const m of [...VOICING.Dbmaj9, 68]) rhodes(s, out, t2, mtof(m), 0.11, 1.3, (m - 60) / 16);
		upright(s, out, t2, mtof(Db2), 0.65, 1.1);
		strum(s, t2 + 0.02, [Db5, Ab5, C6, F6], 0.03, (tt, f, i) => bell(s, out, tt, f, 0.12, -0.3 + 0.2 * i, 1.8));
	}, -2),

	doorsOpen: voice((s, t, out) => {
		for (const m of [Db2, Ab2, Db3]) {
			const end = t + 1.2;
			const lp = s.filter('lowpass', 200, 0.7, out);
			lp.frequency.setValueAtTime(200, t);
			lp.frequency.exponentialRampToValueAtTime(1300, t + 0.75);
			lp.frequency.exponentialRampToValueAtTime(400, end - 0.02);
			const g = s.gain(0, lp);
			swell(g.gain, t, 0.3, 0.6, 0.1, 0.48);
			s.osc('sawtooth', mtof(m), t, end, g);
		}
		const bp = s.filter('bandpass', 300, 1.2, out);
		bp.frequency.setValueAtTime(300, t);
		bp.frequency.exponentialRampToValueAtTime(1900, t + 0.8);
		bp.frequency.exponentialRampToValueAtTime(900, t + 1.15);
		const w = s.gain(0, bp);
		swell(w.gain, t, 0.9, 0.7, 0.05, 0.4);
		s.noise(t, t + 1.18, w);
	}, -2.5),

	curtains: voice((s, t, out) => {
		const p = s.panner(-0.6, out);
		p?.pan.setValueAtTime(-0.6, t);
		p?.pan.linearRampToValueAtTime(0.6, t + 0.85);
		const dest: AudioNode = p ?? out;
		const lp = s.filter('lowpass', 300, 0.6, dest);
		lp.frequency.setValueAtTime(300, t);
		lp.frequency.exponentialRampToValueAtTime(1500, t + 0.35);
		lp.frequency.exponentialRampToValueAtTime(450, t + 0.88);
		const g = s.gain(0, lp);
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(1.4, t + 0.33);
		g.gain.linearRampToValueAtTime(0, t + 0.88);
		s.noise(t, t + 0.9, g);
		brush(s, dest, t + 0.1, 0.6, 0.12, 2500);
	}, -3.5),
};

export const loopSegments: Record<LoopName, LoopSegment> = {
	anticipation: (ctx, out, when) => {
		anticipationLayer(ctx, out, when);
		return ANT_PERIOD;
	},
	countTick: (ctx, out, when, opts) => {
		const s = new Scope(ctx, when);
		tick(s, out, when, tickPitch(opts.index ?? 0), 0.6);
		return 1 / TICK_RATE;
	},
	chipShower: (ctx, out, when) => {
		const s = new Scope(ctx, when);
		scatteredChip(s, out, when);
		return chipInterval();
	},
};
