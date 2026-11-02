import type { BetModeData, BetModeMeta } from 'state-shared';

import type { Copy } from '../i18n/copyData';

// SDK bet-mode metadata for the modes the math publishes. Costs come from the math config
// (exported by math-sdk's export_frontend.py), never from here.

type MathModes = { betModes: Record<string, { cost: number }> };

const KINDS: Record<string, BetModeData['type']> = {
	base: 'default',
	bonus: 'buy',
	super: 'buy',
	hunt: 'activate',
};

const titles = (text: Copy): Record<string, string> => ({
	base: '',
	bonus: text.bonusName,
	super: text.superName,
	hunt: text.huntName,
});

export const buildBetModeMeta = (cfg: MathModes, text: Copy): BetModeMeta => {
	const meta: BetModeMeta = {};
	for (const [mode, { cost }] of Object.entries(cfg.betModes)) {
		const type = KINDS[mode];
		if (!type) continue;
		const title = titles(text)[mode];
		meta[mode.toUpperCase()] = {
			mode,
			costMultiplier: cost,
			type,
			parent: '',
			children: '',
			assets: { icon: '', volatility: '', button: '', dialogImage: '', dialogVolatility: '' },
			text: {
				title,
				dialog: '',
				button: '',
				betAmountLabel: mode === 'hunt' ? text.huntBetLabel(cost) : '',
				tickerIdle: '',
				tickerSpin: '',
			},
		};
	}
	return meta;
};
