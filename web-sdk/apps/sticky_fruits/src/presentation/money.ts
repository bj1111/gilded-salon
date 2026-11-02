// Currency text for every amount the game shows. Unlike the SDK helper (always 2 decimals), it
// follows each currency's own minor units (JPY has none) and widens precision only when a payout is
// smaller than the minor unit, so sub-cent wins never display as zero.

// Stake social-casino coins: shown with their code, never with "$"
const SOCIAL_COINS: Record<string, string> = { XSC: 'SC', XGC: 'GC' };
const MAX_EXTRA_DIGITS = 4;

const currencyDigits = (currency: string) => {
	try {
		return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
	} catch {
		return 2;
	}
};

// fewest decimals (at least `base`) that represent the value exactly, ignoring float noise
const decimalsFor = (value: number, base: number) => {
	for (let digits = base; digits <= base + MAX_EXTRA_DIGITS; digits++) {
		const scaled = value * 10 ** digits;
		if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return digits;
	}
	return base + MAX_EXTRA_DIGITS;
};

// `precisionOf`: for a count-up, the amount being counted to, so every frame uses the same decimals
export const formatMoney = (value: number, currency: string, locale = 'en', precisionOf = value) => {
	const coin = SOCIAL_COINS[currency];
	const base = coin ? 2 : currencyDigits(currency);
	const digits = decimalsFor(precisionOf, base);
	const options = { minimumFractionDigits: digits, maximumFractionDigits: digits };
	if (coin) return `${coin} ${new Intl.NumberFormat(locale, options).format(value)}`;
	try {
		return new Intl.NumberFormat(locale, { ...options, style: 'currency', currency }).format(value);
	} catch {
		return `${currency} ${new Intl.NumberFormat(locale, options).format(value)}`;
	}
};
