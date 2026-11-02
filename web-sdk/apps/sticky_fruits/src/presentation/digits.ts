// Lays a currency string out on a fixed grid so a counting amount never jitters: every digit gets
// the same advance (Josefin Sans digits are proportional), separators a narrow one.

export type Glyph = { char: string; x: number; advance: number };

const advanceFor = (char: string, size: number) => {
	if (/[0-9]/.test(char)) return size * 0.6;
	if (char === '.' || char === ',' || char === "'") return size * 0.3;
	if (char === ' ' || char === ' ') return size * 0.28;
	return size * 0.66;
};

export const layoutDigits = (text: string, size: number) => {
	const chars = [...text];
	const advances = chars.map((char) => advanceFor(char, size));
	const width = advances.reduce((sum, a) => sum + a, 0);
	let cursor = -width / 2;
	const glyphs: Glyph[] = chars.map((char, i) => {
		const glyph = { char, x: cursor + advances[i] / 2, advance: advances[i] };
		cursor += advances[i];
		return glyph;
	});
	return { glyphs, width };
};
