import { describe, expect, it } from 'vitest';

import { buyAvailable, buyButtonShown, buyPrice, canAfford, huntActive } from './buyRules';

describe('buyPrice', () => {
	it('is the bet times the mode cost', () => {
		expect(buyPrice(125, 2)).toBe(250);
	});
});

describe('canAfford', () => {
	it('allows a price equal to the balance', () => {
		expect(canAfford(125, 1, 125)).toBe(true);
	});
	it('refuses a price a cent above the balance', () => {
		expect(canAfford(125, 1, 124.99)).toBe(false);
	});
	it('ignores float noise in bet x cost', () => {
		expect(canAfford(125, 0.1, 12.5)).toBe(true);
		expect(canAfford(3, 0.1, 0.3)).toBe(true);
	});
	it('refuses a zero bet', () => {
		expect(canAfford(125, 0, 100)).toBe(false);
	});
});

describe('buyAvailable', () => {
	it('is off where the jurisdiction disables bought features', () => {
		expect(buyAvailable({ disabledBuyFeature: true }, false)).toBe(false);
	});
	it('is off in replay', () => {
		expect(buyAvailable({}, true)).toBe(false);
	});
	it('is on when the jurisdiction says nothing', () => {
		expect(buyAvailable(undefined, false)).toBe(true);
		expect(buyAvailable({ disabledBuyFeature: false }, false)).toBe(true);
	});
});

describe('huntActive', () => {
	it('matches the hunt mode in either case', () => {
		expect(huntActive('hunt')).toBe(true);
		expect(huntActive('HUNT')).toBe(true);
		expect(huntActive('BASE')).toBe(false);
		expect(huntActive('BONUS')).toBe(false);
	});
});

describe('buyButtonShown', () => {
	it('shows the plaque in the base game where buying is available', () => {
		expect(buyButtonShown({}, false, 'basegame')).toBe(true);
	});
	it('hides it during free spins, in replay and where the jurisdiction disables it', () => {
		expect(buyButtonShown({}, false, 'freegame')).toBe(false);
		expect(buyButtonShown({}, true, 'basegame')).toBe(false);
		expect(buyButtonShown({ disabledBuyFeature: true }, false, 'basegame')).toBe(false);
	});
});
