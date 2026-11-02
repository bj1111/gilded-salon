import { describe, expect, it } from 'vitest';

import { buildBetModeMeta } from './betModes';
import { copy } from '../i18n/copyData';

const cfg = {
	betModes: {
		base: { cost: 1, feature: true, buyBonus: false, rtp: 0.965, max_win: 10000 },
		bonus: { cost: 126, feature: false, buyBonus: true, rtp: 0.965, max_win: 10000 },
		super: { cost: 655, feature: false, buyBonus: true, rtp: 0.965, max_win: 10000 },
		hunt: { cost: 3, feature: true, buyBonus: false, rtp: 0.965, max_win: 10000 },
	},
};

describe('buildBetModeMeta', () => {
	const meta = buildBetModeMeta(cfg, copy(false));

	it('has the four modes keyed as the SDK expects', () => {
		expect(Object.keys(meta).sort()).toEqual(['BASE', 'BONUS', 'HUNT', 'SUPER']);
	});
	it('takes every cost from the math config', () => {
		expect(meta.BONUS.costMultiplier).toBe(126);
		expect(meta.SUPER.costMultiplier).toBe(655);
		expect(meta.HUNT.costMultiplier).toBe(3);
		expect(meta.BASE.costMultiplier).toBe(1);
	});
	it('marks bought modes as buy and Bonus Hunt as activate', () => {
		expect(meta.BASE.type).toBe('default');
		expect(meta.BONUS.type).toBe('buy');
		expect(meta.SUPER.type).toBe('buy');
		expect(meta.HUNT.type).toBe('activate');
	});
	it('labels the bet field while Bonus Hunt is on', () => {
		expect(meta.HUNT.text.betAmountLabel).toBe('BET ×3');
		expect(buildBetModeMeta(cfg, copy(true)).HUNT.text.betAmountLabel).toBe('PLAY ×3');
		expect(meta.BASE.text.betAmountLabel).toBe('');
	});
	it('leaves out modes the math does not publish', () => {
		const baseOnly = buildBetModeMeta({ betModes: { base: cfg.betModes.base } }, copy(false));
		expect(Object.keys(baseOnly)).toEqual(['BASE']);
	});
});
