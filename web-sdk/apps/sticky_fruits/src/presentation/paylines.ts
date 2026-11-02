// Board cells for win presentation, in visible rows (0 = top). The math pads every reel with
// one hidden symbol above and below, so its rows are 1-3 for the visible window.

export type Cell = { reel: number; row: number };

export const winCells = (win: { positions: Cell[] }): Cell[] =>
	win.positions.map(({ reel, row }) => ({ reel, row: row - 1 }));

export const lineCells = (lineIndex: number, paylines: Record<string, readonly number[]>): Cell[] =>
	(paylines[String(lineIndex)] ?? []).map((row, reel) => ({ reel, row }));
