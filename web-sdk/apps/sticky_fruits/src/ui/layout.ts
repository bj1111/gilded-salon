// Where everything sits on screen, in canvas pixels, for each SDK layout type.
// Pure and unit-tested (layout.test.ts) so every required screen size keeps the reels whole and
// the controls apart. Design units are scaled by `u` (px per unit); the board is drawn in its own
// 600 x 360 board units and scaled by `board.scale` (px per board unit).

export type LayoutType = 'desktop' | 'tablet' | 'landscape' | 'portrait';
export type Canvas = { width: number; height: number };
// centre position, footprint (w x h) and the scale a component should apply to its design units
export type Slot = { x: number; y: number; w: number; h: number; scale: number };

export type Layout = {
	type: LayoutType;
	u: number;
	board: Slot;
	logo: Slot;
	win: Slot;
	rail: { y: number; height: number } | null;
	column: { x: number; y: number; w: number; h: number } | null;
	spin: Slot;
	auto: Slot;
	turbo: Slot;
	menu: Slot;
	balance: Slot;
	bet: Slot;
	minus: Slot;
	plus: Slot;
	// BUY BONUS plaque (2:1); scale = px per plaque design unit (plaque is BUY_PLAQUE units wide)
	buy: Slot;
	// BONUS HUNT ribbon under the WIN plaque while Bonus Hunt is on; null where there is no room
	ribbon: Slot | null;
	// design-unit text sizes for HUD values and their captions
	text: { value: number; caption: number };
};

// board art: 600 x 360 reels, frame adds 26 on every side; the crest image (540 x 236) hangs on the
// frame's top edge with its anchor 200 units below its top.
export const BOARD = { w: 600, h: 360 };
const FRAME_PAD = 26;
const FRAME = { w: BOARD.w + FRAME_PAD * 2, h: BOARD.h + FRAME_PAD * 2 };
const CREST = { w: 540, h: 236, above: 200 };

// the BUY BONUS plaque is drawn 260 x 130 design units
export const BUY_PLAQUE = { w: 260, h: 130 };

// Plaque left of the reel frame, as large as the margin allows (at most `maxW` px wide).
const buyBeside = (frameLeft: number, y: number, maxW: number): Slot => {
	const w = Math.min(maxW, frameLeft - 24);
	return { x: frameLeft / 2, y, w, h: w / 2, scale: w / BUY_PLAQUE.w };
};
const plaque = (x: number, y: number, w: number): Slot => ({ x, y, w, h: w / 2, scale: w / BUY_PLAQUE.w });

// 320 x 72 BONUS HUNT ribbon (w in px)
const RIBBON_RATIO = 72 / 320;
const ribbonAt = (x: number, y: number, w: number): Slot => ({ x, y, w, h: w * RIBBON_RATIO, scale: w / 320 });
// hung under the BUY plaque beside the reels
const ribbonUnder = (buy: Slot): Slot => {
	const w = buy.w * 0.9;
	return ribbonAt(buy.x, buy.y + buy.h / 2 + (w * RIBBON_RATIO) / 2 + 6, w);
};
// over the crest, where portrait screens have room
const ribbonOver = (logo: Slot, w: number): Slot =>
	ribbonAt(logo.x, Math.max((w * RIBBON_RATIO) / 2 + 4, logo.y - logo.h / 2 - (w * RIBBON_RATIO) / 2 - 4), w);

const withRibbon = (buy: Slot) => ({ buy, ribbon: ribbonUnder(buy) });

const round = (u: number, x: number, y: number, size: number): Slot => ({ x, y, w: size * u, h: size * u, scale: u });
const rect = (u: number, x: number, y: number, w: number, h: number): Slot => ({ x, y, w: w * u, h: h * u, scale: u });

// Places the frame + crest + win plaque block inside an area, returning board, logo and win slots.
const placeBoard = ({
	u,
	area,
	maxScale,
	crestScale,
	win,
	bias = 0.5,
}: {
	u: number;
	area: { x: number; y: number; w: number; h: number }; // px
	maxScale: number;
	crestScale: number;
	win: { w: number; h: number; gap: number };
	bias?: number;
}) => {
	const crestAbove = CREST.above * crestScale;
	const winZone = win.gap + win.h + 8;
	const areaW = area.w / u;
	const areaH = area.h / u;
	const bs = Math.min(maxScale, (areaW - 24) / FRAME.w, (areaH - 16 - winZone) / (crestAbove + FRAME.h));
	const blockH = (crestAbove + FRAME.h) * bs + winZone;
	const top = area.y / u + Math.max(8, (areaH - blockH) * bias);
	const frameTop = top + crestAbove * bs;
	const cx = (area.x + area.w / 2) / u;
	const cy = frameTop + (FRAME.h / 2) * bs;
	const frameBottom = frameTop + FRAME.h * bs;
	const logoScale = crestScale * bs;
	return {
		board: { x: cx * u, y: cy * u, w: BOARD.w * bs * u, h: BOARD.h * bs * u, scale: bs * u },
		logo: {
			x: cx * u,
			// image centre sits (236/2) below its top, the anchor 200 below its top
			y: (frameTop - (CREST.above - CREST.h / 2) * logoScale) * u,
			w: CREST.w * logoScale * u,
			h: CREST.h * logoScale * u,
			scale: logoScale * u,
		},
		win: rect(u, cx * u, (frameBottom + win.gap + win.h / 2) * u, win.w, win.h),
	};
};

const desktop = ({ width: W, height: H }: Canvas): Layout => {
	const u = Math.min(W / 1422, H / 800);
	const railH = 116 * u;
	const row = H - 58 * u;
	const cx = W / 2;
	const placed = placeBoard({
		u,
		area: { x: 0, y: 0, w: W, h: H - railH - 12 * u },
		maxScale: 1,
		crestScale: 0.78,
		win: { w: 300, h: 60, gap: 10 },
	});
	const frameLeft = placed.board.x - (FRAME.w / 2) * placed.board.scale;
	return {
		type: 'desktop',
		u,
		...placed,
		...withRibbon(buyBeside(frameLeft, placed.board.y, 260 * u)),
		rail: { y: H - railH, height: railH },
		column: null,
		spin: round(u, cx, H - 64 * u, 124),
		auto: round(u, cx - 120 * u, row, 62),
		turbo: round(u, cx + 120 * u, row, 62),
		menu: round(u, cx - 640 * u, row, 58),
		balance: rect(u, cx - 400 * u, row, 240, 64),
		minus: round(u, cx + 282 * u, row, 54),
		bet: rect(u, cx + 400 * u, row, 160, 64),
		plus: round(u, cx + 518 * u, row, 54),
		text: { value: 30, caption: 13 },
	};
};

const tablet = ({ width: W, height: H }: Canvas): Layout => {
	const u = Math.min(W / 1000, H / 1000);
	const railH = 140 * u;
	const row = H - 70 * u;
	const cx = W / 2;
	const placed = placeBoard({
		u,
		area: { x: 0, y: 0, w: W, h: H - railH - 12 * u },
		maxScale: 1.2,
		crestScale: 0.78,
		win: { w: 300, h: 62, gap: 12 },
	});
	const frameLeft = placed.board.x - (FRAME.w / 2) * placed.board.scale;
	return {
		type: 'tablet',
		u,
		...placed,
		...withRibbon(buyBeside(frameLeft, placed.board.y, 260 * u)),
		rail: { y: H - railH, height: railH },
		column: null,
		spin: round(u, cx, H - 74 * u, 118),
		auto: round(u, cx - 116 * u, row, 64),
		turbo: round(u, cx + 116 * u, row, 64),
		menu: round(u, cx - 452 * u, row, 60),
		balance: rect(u, cx - 316 * u, row, 190, 70),
		minus: round(u, cx + 206 * u, row, 56),
		bet: rect(u, cx + 310 * u, row, 140, 70),
		plus: round(u, cx + 416 * u, row, 56),
		text: { value: 32, caption: 14 },
	};
};

// Approved mobile layout: full-width reels, WIN plaque under them, compact control rail in the
// bottom ~quarter (row 1: autoplay, spin, turbo; row 2: menu, balance, bet -/+).
const portrait = ({ width: W, height: H }: Canvas): Layout => {
	const u = Math.min(W / 800, H / 1422);
	const railH = Math.min(0.27 * H, Math.max(0.23 * H, 360 * u));
	const railY = H - railH;
	const row1 = railY + railH * 0.36;
	const row2 = railY + railH * 0.8;
	const cx = W / 2;
	const placed = placeBoard({
		u,
		area: { x: 0, y: 0, w: W, h: railY - 10 * u },
		maxScale: 1.6,
		crestScale: 0.7,
		win: { w: 320, h: 66, gap: 22 },
		bias: 0.45,
	});
	const spin = Math.min(190, (railH * 0.5) / u);
	return {
		type: 'portrait',
		u,
		...placed,
		// left of the WIN plaque
		buy: plaque(116 * u, placed.win.y, 200 * u),
		ribbon: ribbonOver(placed.logo, 300 * u),
		rail: { y: railY, height: railH },
		column: null,
		spin: round(u, cx, row1, spin),
		auto: round(u, cx - 230 * u, row1, 98),
		turbo: round(u, cx + 230 * u, row1, 98),
		menu: round(u, cx - 350 * u, row2, 98),
		balance: rect(u, cx - 175 * u, row2, 200, 80),
		minus: round(u, cx + 30 * u, row2, 98),
		bet: rect(u, cx + 175 * u, row2, 170, 80),
		plus: round(u, cx + 330 * u, row2, 98),
		text: { value: 38, caption: 17 },
	};
};

// Phones held sideways and the small popouts: reels on the left, a control column on the right.
const landscape = ({ width: W, height: H }: Canvas): Layout => {
	const u = Math.min(W / 1600, H / 900);
	const colW = 380 * u;
	const colX = W - 190 * u;
	const placed = placeBoard({
		u,
		area: { x: 0, y: 0, w: W - colW, h: H },
		maxScale: 1.4,
		crestScale: 0.7,
		win: { w: 300, h: 64, gap: 16 },
	});
	const at = (y: number) => (y / 900) * H;
	// BUY BONUS sits in the column under the bet row (the margin beside the reels is too thin here)
	const betBottom = at(690) + 52 * u;
	const buyH = Math.min(120 * u, H - betBottom - 12);
	return {
		type: 'landscape',
		u,
		...placed,
		buy: plaque(colX, (betBottom + H) / 2, buyH * 2),
		ribbon: null,
		rail: null,
		column: { x: W - colW, y: 0, w: colW, h: H },
		spin: round(u, colX, at(470), 200),
		auto: round(u, colX - 96 * u, at(262), 104),
		turbo: round(u, colX + 96 * u, at(262), 104),
		menu: round(u, 70 * u, 70 * u, 104),
		balance: rect(u, colX, at(110), 320, 80),
		minus: round(u, colX - 126 * u, at(690), 104),
		bet: rect(u, colX, at(690), 140, 80),
		plus: round(u, colX + 126 * u, at(690), 104),
		text: { value: 40, caption: 18 },
	};
};

const LAYOUTS: Record<LayoutType, (canvas: Canvas) => Layout> = { desktop, tablet, portrait, landscape };

export const computeLayout = (type: LayoutType, canvas: Canvas): Layout => LAYOUTS[type](canvas);

// Outer edge of the brass frame in canvas pixels.
export const frameRect = (layout: Layout) => {
	const s = layout.board.scale;
	return {
		left: layout.board.x - (FRAME.w / 2) * s,
		right: layout.board.x + (FRAME.w / 2) * s,
		top: layout.board.y - (FRAME.h / 2) * s,
		bottom: layout.board.y + (FRAME.h / 2) * s,
	};
};
