import { describe, expect, it } from 'vitest';

import { formatMoney } from './money';

describe('formatMoney', () => {
	it('uses the currency’s own decimals', () => {
		expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50');
		expect(formatMoney(1234, 'JPY')).toBe('¥1,234');
		expect(formatMoney(2.5, 'EUR')).toBe('€2.50');
	});

	it('shows sub-unit payouts instead of rounding them to zero', () => {
		expect(formatMoney(0.004, 'USD')).toBe('$0.004');
		expect(formatMoney(0.0125, 'USD')).toBe('$0.0125');
		expect(formatMoney(0.4, 'JPY')).toBe('¥0.4');
	});

	it('does not add noise digits from floating point', () => {
		expect(formatMoney(0.1 + 0.2, 'USD')).toBe('$0.30');
		expect(formatMoney(18.099999999999998, 'USD')).toBe('$18.10');
	});

	it('writes social coins without a $ sign', () => {
		expect(formatMoney(12.5, 'XSC')).toBe('SC 12.50');
		expect(formatMoney(3, 'XGC')).toBe('GC 3.00');
	});

	it('falls back gracefully for an unknown currency code', () => {
		expect(formatMoney(1, 'ZZZ')).toMatch(/1\.00/);
	});

	it('formats a counting value with the precision of the amount it counts to', () => {
		expect(formatMoney(3.4567891, 'USD', 'en', 10)).toBe('$3.46');
		expect(formatMoney(0.0021, 'USD', 'en', 0.004)).toBe('$0.002');
	});
});
