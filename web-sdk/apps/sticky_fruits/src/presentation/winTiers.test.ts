import { describe, expect, it } from 'vitest';

import { countUpMs, isTakeover, takeoverSteps, tierForMultiple, TIER_LABEL } from './winTiers';

describe('tierForMultiple', () => {
	it.each([
		[0, 'none'],
		[0.4, 'small'],
		[0.99, 'small'],
		[1, 'nice'],
		[4.99, 'nice'],
		[5, 'great'],
		[14.99, 'great'],
		[15, 'big'],
		[30, 'grand'],
		[50, 'mega'],
		[100, 'legendary'],
		[9999.9, 'legendary'],
		[10000, 'max'],
	] as const)('%s× → %s', (multiple, tier) => {
		expect(tierForMultiple(multiple)).toBe(tier);
	});
});

describe('isTakeover', () => {
	it('is true from big upwards only', () => {
		expect(isTakeover('great')).toBe(false);
		expect(isTakeover('big')).toBe(true);
		expect(isTakeover('max')).toBe(true);
	});
});

describe('countUpMs', () => {
	it('scales with the tier', () => {
		expect(countUpMs('none', { fast: false })).toBe(0);
		expect(countUpMs('small', { fast: false })).toBe(500);
		expect(countUpMs('big', { fast: false })).toBe(4000);
		expect(countUpMs('max', { fast: false })).toBe(12000);
	});

	it('halves in fast mode but never drops below 300 ms for a real win', () => {
		expect(countUpMs('small', { fast: true })).toBe(300);
		expect(countUpMs('big', { fast: true })).toBe(2000);
		expect(countUpMs('none', { fast: true })).toBe(0);
	});
});

describe('takeoverSteps', () => {
	it('lists each takeover threshold the amount passes, in book units', () => {
		expect(takeoverSteps(4500)).toEqual([
			{ tier: 'big', at: 1500 },
			{ tier: 'grand', at: 3000 },
		]);
	});

	it('is empty below a big win', () => {
		expect(takeoverSteps(1499)).toEqual([]);
	});

	it('reaches max at the 10,000× cap', () => {
		expect(takeoverSteps(1_000_000).map((step) => step.tier)).toEqual([
			'big',
			'grand',
			'mega',
			'legendary',
			'max',
		]);
	});
});

describe('TIER_LABEL', () => {
	it('names the takeover tiers', () => {
		expect(TIER_LABEL.big).toBe('BIG WIN');
		expect(TIER_LABEL.legendary).toBe('LEGENDARY');
		expect(TIER_LABEL.max).toBe('MAX WIN');
	});
});
