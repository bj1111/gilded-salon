// One bet-level step up or down; used by the HUD and the buy menu.
export const nextBet = (levels: readonly number[], current: number, direction: 1 | -1) => {
	const sorted = [...levels].sort((a, b) => a - b);
	const next =
		direction > 0 ? sorted.find((level) => level > current) : [...sorted].reverse().find((level) => level < current);
	return next ?? (direction > 0 ? sorted[sorted.length - 1] : sorted[0]);
};
