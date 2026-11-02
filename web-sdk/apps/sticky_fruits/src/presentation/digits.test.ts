import { describe, expect, it } from 'vitest';

import { layoutDigits } from './digits';

describe('layoutDigits', () => {
	it('gives every digit the same advance so counting never jitters', () => {
		const a = layoutDigits('$1,111.11', 100);
		const b = layoutDigits('$8,888.88', 100);
		expect(a.width).toBe(b.width);
		expect(a.glyphs.map((g) => g.x)).toEqual(b.glyphs.map((g) => g.x));
	});

	it('centres the string on 0', () => {
		const { glyphs, width } = layoutDigits('12', 100);
		expect(glyphs[0].x).toBeCloseTo(-width / 2 + glyphs[0].advance / 2);
		expect(glyphs[1].x + glyphs[1].advance / 2).toBeCloseTo(width / 2);
	});

	it('keeps separators narrow', () => {
		const { glyphs } = layoutDigits('1.0', 100);
		expect(glyphs[1].advance).toBeLessThan(glyphs[0].advance);
	});
});
