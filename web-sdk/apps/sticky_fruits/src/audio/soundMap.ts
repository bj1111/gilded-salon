/**
 * Gilded Salon sound map: the semantic sound names the game uses, mixing constants, and the small
 * pure helpers (volume curve, pitch ladders) shared by the engine and the synth voices.
 */

export type SfxName =
	| 'uiClick'
	| 'spinPress'
	| 'reelStart'
	| 'reelStop'
	| 'wildLand'
	| 'keyLand'
	| 'anticipation'
	| 'lineTrace'
	| 'winSmall'
	| 'winNice'
	| 'winGreat'
	| 'countTick'
	| 'countEnd'
	| 'tierBig'
	| 'tierGrand'
	| 'tierMega'
	| 'tierLegendary'
	| 'tierMax'
	| 'chipShower'
	| 'freeSpinsIntro'
	| 'chipLock'
	| 'retrigger'
	| 'bonusEnd'
	| 'doorsOpen'
	| 'curtains';

export type MusicTrack = 'base' | 'private' | null;
export type MusicTrackName = Exclude<MusicTrack, null>;

/** Sounds that can run as a continuous layer via `audio.loop()`. */
export type LoopName = 'anticipation' | 'countTick' | 'chipShower';

/**
 * `index`: reel 0-4 for reelStop (pitch/pan spread), key count 1-5 for keyLand (rising pitch),
 * progress 0-1 for countTick (rising pitch). `volume`: per-play gain 0..1.
 */
export type PlayOptions = { index?: number; volume?: number };

// A Record keyed by SfxName makes the list exhaustive at compile time.
const ALL: Record<SfxName, true> = {
	uiClick: true,
	spinPress: true,
	reelStart: true,
	reelStop: true,
	wildLand: true,
	keyLand: true,
	anticipation: true,
	lineTrace: true,
	winSmall: true,
	winNice: true,
	winGreat: true,
	countTick: true,
	countEnd: true,
	tierBig: true,
	tierGrand: true,
	tierMega: true,
	tierLegendary: true,
	tierMax: true,
	chipShower: true,
	freeSpinsIntro: true,
	chipLock: true,
	retrigger: true,
	bonusEnd: true,
	doorsOpen: true,
	curtains: true,
};

export const SFX_NAMES: readonly SfxName[] = Object.freeze(Object.keys(ALL) as SfxName[]);
export const LOOP_NAMES: readonly LoopName[] = Object.freeze(['anticipation', 'countTick', 'chipShower'] as LoopName[]);

/** One-shots that may overlap themselves (fired in quick succession by design). */
export const STACKABLE: ReadonlySet<SfxName> = new Set<SfxName>(['reelStop', 'keyLand', 'countTick']);

// ---- mixing constants -----------------------------------------------------------------------

/** Same-name one-shots fired closer than this are dropped (except STACKABLE). */
export const DEDUPE_WINDOW = 0.025;
/** Hard cap on simultaneously sounding one-shots. */
export const MAX_ONE_SHOTS = 40;
/** Music sits this far under the sfx bus. */
export const MUSIC_BUS_DB = -14;
/** Reverb send level (wet ≈ 18 %). */
export const ROOM_SEND = 0.18;
/** Master gain at volume 1 (headroom into the limiter). */
export const MASTER_TRIM = 0.9;
export const LOOP_FADE = 0.12;
export const MUSIC_CROSSFADE = 1.2;
/** Lookahead scheduler: timer period (ms) and how far ahead events are committed (s). */
export const SCHEDULER_INTERVAL_MS = 25;
export const SCHEDULE_AHEAD = 0.12;

// ---- pure helpers ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const dbToGain = (db: number) => 10 ** (db / 20);

/** Perceptual volume curve: slider 0..1 → linear gain 0..1 (square law). */
export function gainForVolume(v: number): number {
	if (!Number.isFinite(v)) return v === Infinity ? 1 : 0;
	const x = clamp(v, 0, 1);
	return x * x;
}

// A♭5, D♭6, F6, A♭6, D♭7 — the D♭ major triad climbing with every key that lands.
const KEY_SEMITONES = [0, 5, 9, 12, 17];

/** Frequency multiplier (relative to A♭5) for the n-th landed key, n = 1..5 (clamped). */
export function keyPitch(index: number): number {
	const n = Number.isFinite(index) ? clamp(Math.round(index), 1, 5) : 1;
	return 2 ** (KEY_SEMITONES[n - 1] / 12);
}

/** Count-up tick pitch multiplier: rises one octave (1 → 2) as progress goes 0 → 1. */
export function tickPitch(progress: number): number {
	const p = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
	return 2 ** p;
}
