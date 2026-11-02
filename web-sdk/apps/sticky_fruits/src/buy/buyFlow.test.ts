import { describe, expect, it } from 'vitest';

import { startBuy, setHunt } from './buyFlow';

const harness = (balance: number) => {
	const calls: string[] = [];
	let mode = 'BASE';
	let confirming: string | null = 'BONUS';
	return {
		calls,
		mode: () => mode,
		confirming: () => confirming,
		ctx: {
			cost: 128,
			bet: 1,
			balance,
			setMode: (key: string) => {
				calls.push(`mode:${key}`);
				mode = key;
			},
			clearConfirm: () => {
				confirming = null;
			},
			broadcastBet: () => calls.push('bet'),
		},
	};
};

describe('startBuy', () => {
	it('sets the mode before starting the bet', () => {
		const h = harness(500);
		expect(startBuy('BONUS', h.ctx)).toBe(true);
		expect(h.calls).toEqual(['mode:BONUS', 'bet']);
		expect(h.confirming()).toBeNull();
	});

	it('refuses a buy the balance cannot cover and sends nothing', () => {
		const h = harness(127.99);
		expect(startBuy('BONUS', h.ctx)).toBe(false);
		expect(h.calls).toEqual([]);
		expect(h.mode()).toBe('BASE');
	});
});

describe('setHunt', () => {
	it('switches Bonus Hunt on and off without starting a bet', () => {
		const calls: string[] = [];
		const setMode = (key: string) => calls.push(key);
		setHunt(true, setMode);
		setHunt(false, setMode);
		expect(calls).toEqual(['HUNT', 'BASE']);
	});
});
