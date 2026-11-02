import { describe, expect, it } from 'vitest';

import {
	LOOP_NAMES,
	SFX_NAMES,
	STACKABLE,
	gainForVolume,
	keyPitch,
	tickPitch,
	type SfxName,
} from './soundMap';

// Compile-time exhaustiveness: adding/removing an SfxName without updating this table is a type error.
const EVERY_SFX: Record<SfxName, true> = {
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

describe('SFX_NAMES', () => {
	it('lists every SfxName exactly once', () => {
		expect([...SFX_NAMES].sort()).toEqual(Object.keys(EVERY_SFX).sort());
		expect(new Set(SFX_NAMES).size).toBe(SFX_NAMES.length);
		expect(SFX_NAMES.length).toBe(25);
	});

	it('loops and stackables are real sfx names', () => {
		expect([...LOOP_NAMES].sort()).toEqual(['anticipation', 'chipShower', 'countTick']);
		for (const n of LOOP_NAMES) expect(SFX_NAMES).toContain(n);
		expect([...STACKABLE].sort()).toEqual(['countTick', 'keyLand', 'reelStop']);
	});
});

describe('gainForVolume', () => {
	it('maps the ends exactly', () => {
		expect(gainForVolume(0)).toBe(0);
		expect(gainForVolume(1)).toBe(1);
	});

	it('is a perceptual (convex) curve', () => {
		expect(gainForVolume(0.5)).toBeCloseTo(0.25, 6);
		expect(gainForVolume(0.5)).toBeLessThan(0.5);
	});

	it('is monotonic increasing', () => {
		let prev = -1;
		for (let i = 0; i <= 100; i++) {
			const g = gainForVolume(i / 100);
			expect(g).toBeGreaterThan(prev);
			prev = g;
		}
	});

	it('clamps out-of-range and garbage input', () => {
		expect(gainForVolume(-3)).toBe(0);
		expect(gainForVolume(7)).toBe(1);
		expect(gainForVolume(Number.NaN)).toBe(0);
	});
});

describe('keyPitch', () => {
	// A♭5 → D♭6 → F6 → A♭6 → D♭7 : 0, +5, +9, +12, +17 semitones.
	const semis = [0, 5, 9, 12, 17];

	it('follows the D♭ major key ladder for 1..5 keys', () => {
		semis.forEach((s, i) => expect(keyPitch(i + 1)).toBeCloseTo(2 ** (s / 12), 6));
	});

	it('rises strictly with key count', () => {
		for (let i = 1; i < 5; i++) expect(keyPitch(i + 1)).toBeGreaterThan(keyPitch(i));
	});

	it('clamps outside 1..5 and handles garbage', () => {
		expect(keyPitch(0)).toBe(keyPitch(1));
		expect(keyPitch(-4)).toBe(keyPitch(1));
		expect(keyPitch(9)).toBe(keyPitch(5));
		expect(keyPitch(2.4)).toBe(keyPitch(2));
		expect(keyPitch(Number.NaN)).toBe(keyPitch(1));
	});
});

describe('tickPitch', () => {
	it('rises from 1 to ~2 over 0..1', () => {
		expect(tickPitch(0)).toBe(1);
		expect(tickPitch(1)).toBeCloseTo(2, 6);
		expect(tickPitch(0.5)).toBeGreaterThan(1.3);
		expect(tickPitch(0.5)).toBeLessThan(1.6);
	});

	it('is monotonic', () => {
		let prev = 0;
		for (let i = 0; i <= 50; i++) {
			const p = tickPitch(i / 50);
			expect(p).toBeGreaterThan(prev);
			prev = p;
		}
	});

	it('clamps', () => {
		expect(tickPitch(-1)).toBe(1);
		expect(tickPitch(5)).toBeCloseTo(2, 6);
		expect(tickPitch(Number.NaN)).toBe(1);
	});
});
