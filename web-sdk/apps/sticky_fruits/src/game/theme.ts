// Gilded Salon design tokens: one palette and type scale for every element.
// Monte Carlo 1928 — black lacquer, emerald felt, champagne gold, ivory type, a single rouge accent.

export const COLOR = {
	lacquer: 0x0b0c0e,
	lacquerLight: 0x1a1c21,
	felt: 0x145142,
	goldLight: 0xfff4cf,
	gold: 0xf0d592,
	goldMid: 0xc99a45,
	goldDark: 0x8c6a2e,
	goldShadow: 0x2a1d06,
	ivory: 0xf5ecd9,
	ivoryMuted: 0xb9ad94,
	rouge: 0xb3122e,
	black: 0x000000,
} as const;

export const FONT = {
	display: "Limelight, Georgia, 'Times New Roman', serif",
	ui: "'Josefin Sans', 'Helvetica Neue', Arial, sans-serif",
} as const;

type Overrides = Record<string, unknown>;

const shadow = (size: number, alpha = 0.6) => ({
	color: COLOR.black,
	alpha,
	blur: Math.max(2, size * 0.12),
	distance: Math.max(1, size * 0.05),
	angle: Math.PI / 2,
});

export const textStyle = {
	// Limelight headings and banners in gold
	display: (size: number, overrides: Overrides = {}) => ({
		fontFamily: FONT.display,
		fontSize: size,
		fill: COLOR.gold,
		stroke: { color: COLOR.goldShadow, width: Math.max(2, size * 0.05) },
		dropShadow: shadow(size),
		letterSpacing: size * 0.08,
		...overrides,
	}),
	// amounts and counters in ivory
	value: (size: number, overrides: Overrides = {}) => ({
		fontFamily: FONT.ui,
		fontWeight: '700' as const,
		fontSize: size,
		fill: COLOR.ivory,
		dropShadow: shadow(size, 0.55),
		...overrides,
	}),
	// small spaced capitals above values (BALANCE, BET, WIN)
	caption: (size: number, overrides: Overrides = {}) => ({
		fontFamily: FONT.ui,
		fontWeight: '700' as const,
		fontSize: size,
		fill: COLOR.goldMid,
		letterSpacing: size * 0.35,
		...overrides,
	}),
	// sentences on panels and prompts
	body: (size: number, overrides: Overrides = {}) => ({
		fontFamily: FONT.ui,
		fontWeight: '600' as const,
		fontSize: size,
		fill: COLOR.ivory,
		letterSpacing: size * 0.04,
		...overrides,
	}),
};
