import { describe, expect, it } from 'vitest';

import config from '../game/config';
import { lineCells, winCells } from './paylines';

describe('winCells', () => {
	it('converts padded math rows to visible rows', () => {
		const cells = winCells({
			positions: [
				{ reel: 0, row: 1 },
				{ reel: 1, row: 3 },
			],
		});
		expect(cells).toEqual([
			{ reel: 0, row: 0 },
			{ reel: 1, row: 2 },
		]);
	});
});

describe('lineCells', () => {
	it('returns the five visible cells of a payline', () => {
		expect(lineCells(4, config.paylines).map((cell) => cell.row)).toEqual([0, 1, 2, 1, 0]);
		expect(lineCells(4, config.paylines).map((cell) => cell.reel)).toEqual([0, 1, 2, 3, 4]);
	});

	it('covers all 20 lines', () => {
		for (let line = 1; line <= 20; line++) expect(lineCells(line, config.paylines)).toHaveLength(5);
	});
});
