/**
 * Generative-but-deterministic lounge music.
 *
 * Both tracks are an eighth-note step grid. Every step is scheduled from absolute time
 * (`start + step * …`), so pumping the sequencer in small lookahead slices produces exactly the
 * same events as rendering it in one go — no drift. Variation (humanized timing, velocities,
 * a second chorus) comes from a PRNG seeded by the step index, so a given bar always sounds the same.
 *
 * - base:    92 BPM swing, D♭maj9 – B♭m9 – E♭m9 – A♭13 (2 bars each). Rhodes comps on 2 & 4 with
 *            anticipations, walking upright bass, brushes and a soft ride, a vibes fill per chorus.
 * - private: 100 BPM straight, B♭m9 – G♭maj9 – E♭m9 – F7♭9. Pulsing bass eighths, sustained pad,
 *            brushed hats, heartbeat pulse, occasional celesta motif.
 */
import type { MusicTrackName } from './soundMap';
import {
	Scope,
	VOICING,
	brush,
	celesta,
	mtof,
	noiseHit,
	pad,
	prng,
	rhodes,
	ride,
	thud,
	upright,
	vibes,
} from './voices';

type StepFn = (s: Scope, out: AudioNode, step: number, t: number, beat: number, rnd: () => number) => void;

export type TrackDef = {
	bpm: number;
	/** Position of the off-beat eighth within the beat (0.5 = straight, 0.667 = triplet swing). */
	swing: number;
	seed: number;
	schedule: StepFn;
};

const STEPS_PER_BAR = 8;

// ---- base: "Salon" -------------------------------------------------------------------------------

const BASE_CHORDS = [VOICING.Dbmaj9, VOICING.Bbm9, VOICING.Ebm9, VOICING.Ab13];

// Walking bass, one row per bar (quarter notes), last note of each chord approaches the next root.
const WALK_A = [
	[37, 41, 44, 48], // D♭ F A♭ C
	[49, 48, 44, 45], // D♭ C A♭ A → B♭
	[46, 44, 41, 37], // B♭ A♭ F D♭
	[34, 37, 41, 40], // B♭ D♭ F E → E♭
	[39, 42, 46, 49], // E♭ G♭ B♭ D♭
	[51, 49, 46, 45], // E♭ D♭ B♭ A → A♭
	[44, 42, 41, 39], // A♭ G♭ F E♭
	[32, 36, 39, 38], // A♭ C E♭ D → D♭
];
const WALK_B = [
	[37, 44, 41, 44],
	[37, 39, 41, 45],
	[46, 41, 44, 46],
	[49, 44, 41, 40],
	[39, 46, 42, 46],
	[39, 41, 42, 45],
	[44, 48, 51, 48],
	[44, 39, 36, 38],
];

function comp(s: Scope, out: AudioNode, t: number, chord: readonly number[], vel: number, len: number, rnd: () => number) {
	chord.forEach((m, i) => rhodes(s, out, t + i * 0.007 + rnd() * 0.004, mtof(m), vel * (0.9 + rnd() * 0.2), len, (m - 58) / 18));
}

const baseStep: StepFn = (s, out, step, t, beat, rnd) => {
	const bar = Math.floor(step / STEPS_PER_BAR);
	const pos = step % STEPS_PER_BAR;
	const b = pos >> 1;
	const off = pos & 1;
	const cyc = bar % 16;
	const pb = bar % 8;
	const chorusB = cyc >= 8;
	const ci = pb >> 1;
	const chord = BASE_CHORDS[ci];
	const next = BASE_CHORDS[(ci + 1) % 4];
	const line = chorusB ? WALK_B : WALK_A;
	const hum = rnd() * 0.006;

	// walking bass (+ a ghosted "skip" note now and then)
	if (!off) upright(s, out, t + hum, mtof(line[pb][b]), b === 0 ? 0.62 : 0.54, beat * 0.9);
	if (off && b === 2 && (pb === 1 || pb === 5)) upright(s, out, t + hum, mtof(line[pb][3]), 0.2, beat * 0.22);

	// Rhodes comping on 2 & 4, anticipating the next chord on the and-of-4
	const second = pb % 2 === 1;
	const cv = 0.11;
	if (pos === 2) comp(s, out, t + hum, chord, cv, beat * 0.55, rnd);
	if (!second && pos === 6) comp(s, out, t + hum, chord, cv * 0.9, beat * 0.5, rnd);
	if (second && pos === 5) comp(s, out, t + hum, chord, cv * 0.65, beat * 0.3, rnd);
	if (second && pos === 7) comp(s, out, t + hum, next, cv, beat * 1.5, rnd);
	if (chorusB && !second && pos === 1) comp(s, out, t + hum, chord, cv * 0.55, beat * 0.25, rnd);

	// ride: ding, ding-da ding, ding-da
	if (pos !== 1 && pos !== 5) {
		const v = pos === 3 || pos === 7 ? 0.32 : b === 1 || b === 3 ? 0.55 : 0.45;
		ride(s, out, t + hum * 0.5, v * (0.9 + rnd() * 0.2));
	}

	// brushes: a swirl every beat, a light slap on 2 & 4
	if (!off) brush(s, out, t, beat * 0.95, 0.075 + rnd() * 0.02, 3000, b % 2 ? 0.3 : -0.3);
	if (pos === 2 || pos === 6) noiseHit(s, out, t + hum, 'bandpass', 2100, 0.9, 0.42, 0.003, 0.13);

	// a soft vibes fill at the end of each chorus
	const fill: Record<number, [number, number][]> = {
		7: [
			[2, 77],
			[3, 75],
			[4, 72],
			[6, 68],
		],
		15: [
			[2, 75],
			[3, 77],
			[4, 80],
			[6, 84],
		],
	};
	const note = fill[cyc]?.find(([p]) => p === pos);
	if (note) vibes(s, out, t + hum, mtof(note[1]), 0.15, 0.25, 1.3);
};

// ---- private: "The Private Room" ---------------------------------------------------------------

const PRIVATE_CHORDS = [
	VOICING.Bbm9, // F A♭ C D♭
	[53, 56, 58, 61], // G♭maj9: F A♭ B♭ D♭
	[53, 54, 58, 61], // E♭m9: F G♭ B♭ D♭
	[51, 54, 57, 60], // F7♭9: E♭ G♭ A C
] as const;
const PRIVATE_ROOTS = [46, 42, 39, 41]; // B♭2 G♭2 E♭2 F2

const MOTIFS: Record<number, [number, number][]> = {
	1: [
		[0, 77],
		[2, 85],
		[3, 84],
		[6, 80],
	], // F5 D♭6 C6 A♭5
	5: [
		[0, 78],
		[2, 77],
		[3, 85],
		[6, 82],
	], // G♭5 F5 D♭6 B♭5
	13: [
		[0, 82],
		[2, 80],
		[3, 77],
		[6, 85],
	], // B♭5 A♭5 F5 D♭6
	15: [[4, 81]], // A5 — leading tone back to B♭
};

const privateStep: StepFn = (s, out, step, t, beat, rnd) => {
	const bar = Math.floor(step / STEPS_PER_BAR);
	const pos = step % STEPS_PER_BAR;
	const cyc = bar % 16;
	const pb = bar % 8;
	const ci = pb >> 1;
	const second = pb % 2 === 1;
	const root = PRIVATE_ROOTS[ci];
	const hum = rnd() * 0.004;

	// pulsing bass eighths; a fifth for motion, a chromatic approach into the next chord
	let m = root;
	if (second && pos === 7) m = PRIVATE_ROOTS[(ci + 1) % 4] + 1;
	else if (second && pos === 6) m = root + 7;
	upright(s, out, t + hum, mtof(m), pos % 2 ? 0.36 : 0.5, beat * 0.4);

	// sustained pad, crossfading chord to chord
	if (pos === 0 && !second) {
		for (const n of PRIVATE_CHORDS[ci]) pad(s, out, t, mtof(n), 0.032, beat * 8, beat * 1.5, beat * 1.6, 1000, (n - 56) / 14);
	}

	// brushed hats on the off-beats, slap on 2 & 4, heartbeat pulse on 1 (and softly on 3)
	if (pos % 2) noiseHit(s, out, t + hum, 'highpass', 7000, 0.7, 0.16 + rnd() * 0.05, 0.001, 0.05);
	if (pos === 2 || pos === 6) noiseHit(s, out, t + hum, 'bandpass', 1900, 0.9, 0.36, 0.003, 0.12);
	if (pos === 0) thud(s, out, t, 66, 46, 0.26, 0.55);
	if (pos === 4) thud(s, out, t, 62, 44, 0.22, 0.3);

	// occasional celesta motif
	const note = MOTIFS[cyc]?.find(([p]) => p === pos);
	if (note) celesta(s, out, t + hum, mtof(note[1]), 0.14, (note[1] - 80) / 10, 1.4);
};

// ---------------------------------------------------------------------------------------------------

export const MUSIC_TRACKS: Record<MusicTrackName, TrackDef> = {
	base: { bpm: 92, swing: 0.64, seed: 0x1928, schedule: baseStep },
	private: { bpm: 100, swing: 0.5, seed: 0x5a10, schedule: privateStep },
};

export const barSeconds = (track: MusicTrackName) => (4 * 60) / MUSIC_TRACKS[track].bpm;

/** Absolute time of a step (eighth note) — computed from the start, never accumulated. */
export function stepTime(def: TrackDef, start: number, step: number): number {
	const beat = 60 / def.bpm;
	return start + Math.floor(step / 2) * beat + (step % 2 ? def.swing * beat : 0);
}

export class MusicSequencer {
	private step = 0;
	private readonly def: TrackDef;

	constructor(
		private readonly ctx: BaseAudioContext,
		private readonly out: AudioNode,
		readonly track: MusicTrackName,
		readonly start: number,
	) {
		this.def = MUSIC_TRACKS[track];
	}

	/**
	 * Schedule every step that starts before `horizon`. Steps already in the past (timer stalled)
	 * are skipped rather than played late; `silent` advances the grid without making sound.
	 */
	pump(horizon: number, now: number, silent = false) {
		const beat = 60 / this.def.bpm;
		for (;;) {
			const t = stepTime(this.def, this.start, this.step);
			if (t >= horizon) break;
			if (!silent && t >= now - 0.02) {
				const s = new Scope(this.ctx, t);
				this.def.schedule(s, this.out, this.step, t, beat, prng((this.step * 2654435761) ^ this.def.seed));
			}
			this.step++;
		}
	}
}

/** Schedule `bars` bars of a track at `when` in one go (offline rendering). Returns the length in seconds. */
export function renderMusic(
	ctx: BaseAudioContext,
	out: AudioNode,
	track: MusicTrackName,
	when: number,
	bars: number,
): number {
	const dur = bars * barSeconds(track);
	new MusicSequencer(ctx, out, track, when).pump(when + dur - 1e-9, when);
	return dur;
}
