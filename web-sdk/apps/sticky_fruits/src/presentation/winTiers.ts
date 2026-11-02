// How loudly a win is celebrated, decided from the win multiple (book amount / 100).
// Thresholds follow the math's "standard" win-level bands, so a 15× spin and a 15× bonus
// total get the same treatment (the math's level numbers mean different things per event).

export type WinTier = 'none' | 'small' | 'nice' | 'great' | 'big' | 'grand' | 'mega' | 'legendary' | 'max';

// lower bound (× bet) of each tier, highest first
const THRESHOLDS: [WinTier, number][] = [
	['max', 10000],
	['legendary', 100],
	['mega', 50],
	['grand', 30],
	['big', 15],
	['great', 5],
	['nice', 1],
];

const TAKEOVER_TIERS: WinTier[] = ['big', 'grand', 'mega', 'legendary', 'max'];

const COUNT_UP_MS: Record<WinTier, number> = {
	none: 0,
	small: 500,
	nice: 1100,
	great: 1800,
	big: 4000,
	grand: 6000,
	mega: 8000,
	legendary: 10000,
	max: 12000,
};

export const TIER_LABEL: Record<WinTier, string> = {
	none: '',
	small: '',
	nice: '',
	great: '',
	big: 'BIG WIN',
	grand: 'GRAND WIN',
	mega: 'MEGA WIN',
	legendary: 'LEGENDARY',
	max: 'MAX WIN',
};

export const BOOK_UNITS_PER_BET = 100;

export const tierForMultiple = (multiple: number): WinTier => {
	if (multiple <= 0) return 'none';
	return THRESHOLDS.find(([, min]) => multiple >= min)?.[0] ?? 'small';
};

export const tierForAmount = (bookAmount: number) => tierForMultiple(bookAmount / BOOK_UNITS_PER_BET);

export const isTakeover = (tier: WinTier) => TAKEOVER_TIERS.includes(tier);

export const countUpMs = (tier: WinTier, { fast }: { fast: boolean }) => {
	const ms = COUNT_UP_MS[tier];
	if (!fast || ms === 0) return ms;
	return Math.max(300, ms / 2);
};

// Points (in book units) where the takeover banner upgrades while the counter climbs.
export const takeoverSteps = (bookAmount: number) =>
	THRESHOLDS.filter(([tier, min]) => TAKEOVER_TIERS.includes(tier) && bookAmount >= min * BOOK_UNITS_PER_BET)
		.map(([tier, min]) => ({ tier, at: min * BOOK_UNITS_PER_BET }))
		.reverse();
