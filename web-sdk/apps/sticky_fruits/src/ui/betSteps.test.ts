import { describe, expect, it } from 'vitest';

import { nextBet } from './betSteps';

const levels = [1, 0.1, 0.5, 2];

describe('nextBet', () => {
	it('steps to the next level up or down from the sorted levels', () => {
		expect(nextBet(levels, 0.5, 1)).toBe(1);
		expect(nextBet(levels, 0.5, -1)).toBe(0.1);
	});
	it('stays at the ends', () => {
		expect(nextBet(levels, 2, 1)).toBe(2);
		expect(nextBet(levels, 0.1, -1)).toBe(0.1);
	});
	it('snaps a bet between levels to the neighbouring level', () => {
		expect(nextBet(levels, 0.7, 1)).toBe(1);
		expect(nextBet(levels, 0.7, -1)).toBe(0.5);
	});
});
