import _ from 'lodash';

import type { RawSymbol, SymbolState } from './types';

export const SYMBOL_SIZE = 120;

// symbols sit in the centre of their column
export const REEL_PADDING = 0.5;

// initial board (padded top and bottom)
export const INITIAL_BOARD: RawSymbol[][] = [
	[
		{
			name: 'L2',
		},
		{
			name: 'L1',
		},
		{
			name: 'L4',
		},
		{
			name: 'H2',
		},
		{
			name: 'L1',
		},
	],
	[
		{
			name: 'H1',
		},
		{
			name: 'L5',
		},
		{
			name: 'L2',
		},
		{
			name: 'H3',
		},
		{
			name: 'L4',
		},
	],
	[
		{
			name: 'L3',
		},
		{
			name: 'L5',
		},
		{
			name: 'L3',
		},
		{
			name: 'H4',
		},
		{
			name: 'L4',
		},
	],
	[
		{
			name: 'H4',
		},
		{
			name: 'H3',
		},
		{
			name: 'L4',
		},
		{
			name: 'L5',
		},
		{
			name: 'L1',
		},
	],
	[
		{
			name: 'H3',
		},
		{
			name: 'L3',
		},
		{
			name: 'L3',
		},
		{
			name: 'H1',
		},
		{
			name: 'H1',
		},
	],
];

export const BOARD_DIMENSIONS = { x: INITIAL_BOARD.length, y: INITIAL_BOARD[0].length - 2 };

export const BOARD_SIZES = {
	width: SYMBOL_SIZE * BOARD_DIMENSIONS.x,
	height: SYMBOL_SIZE * BOARD_DIMENSIONS.y,
};

export const BACKGROUND_RATIO = 2039 / 1000;
export const PORTRAIT_BACKGROUND_RATIO = 1242 / 2208;
const PORTRAIT_RATIO = 800 / 1422;
const LANDSCAPE_RATIO = 1600 / 900;
const DESKTOP_RATIO = 1422 / 800;

const DESKTOP_HEIGHT = 800;
const LANDSCAPE_HEIGHT = 900;
const PORTRAIT_HEIGHT = 1422;
export const DESKTOP_MAIN_SIZES = { width: DESKTOP_HEIGHT * DESKTOP_RATIO, height: DESKTOP_HEIGHT };
export const LANDSCAPE_MAIN_SIZES = {
	width: LANDSCAPE_HEIGHT * LANDSCAPE_RATIO,
	height: LANDSCAPE_HEIGHT,
};
export const PORTRAIT_MAIN_SIZES = {
	width: PORTRAIT_HEIGHT * PORTRAIT_RATIO,
	height: PORTRAIT_HEIGHT,
};

export const INITIAL_SYMBOL_STATE: SymbolState = 'static';

// Reel timing (speeds in board units per ms; a cell is SYMBOL_SIZE = 120 units).
// Normal: reels set off 70 ms apart with a backIn wind-up, stop ~180 ms apart (5.5 extra cells at
// 3.6 u/ms each), overshoot ~12 units and settle over ~120 ms. Anticipated reels spin ~1.3 s longer.
// Only speed and easing are tuned here: which symbols land always comes from the book.
const SPIN_OPTIONS_SHARED = {
	reelBounceBackSpeed: 0.1,
	reelSpinSpeedBeforeBounce: 4,
	reelPaddingMultiplierNormal: 1.1,
	reelPaddingMultiplierAnticipated: 8,
	reelSpinDelay: 70,
};

export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 2.4,
	reelSpinSpeed: 3.6,
	reelBounceSizeMulti: 0.1,
};

export const SPIN_OPTIONS_FAST = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 5,
	reelSpinSpeed: 5.5,
	reelBounceSizeMulti: 0.04,
};

// Symbol art keys (see art/generate.mjs); each has a motion-blurred `_blur` twin for spinning.
export const SYMBOL_ART_KEYS = {
	H1: 'sym_H1',
	H2: 'sym_H2',
	H3: 'sym_H3',
	H4: 'sym_H4',
	L1: 'sym_L1',
	L2: 'sym_L2',
	L3: 'sym_L3',
	L4: 'sym_L4',
	L5: 'sym_L5',
	W: 'sym_W',
	S: 'sym_S',
} as const;

type SizeRatios = { width: number; height: number };
export type SymbolInfoArt = { type: 'art'; pulse: boolean; blur: boolean };
export type SymbolInfoSprite = { type: 'sprite'; assetKey: string; sizeRatios: SizeRatios };
export type SymbolInfoSpine = {
	type: 'spine';
	assetKey: string;
	animationName: string;
	sizeRatios: SizeRatios;
};
export type SymbolInfo = SymbolInfoArt | SymbolInfoSprite | SymbolInfoSpine;

const artStatic = { type: 'art', pulse: false, blur: false } as const;
const artStates = {
	static: artStatic,
	land: artStatic,
	postWinStatic: artStatic,
	explosion: artStatic,
	spin: { type: 'art', pulse: false, blur: true },
	win: { type: 'art', pulse: true, blur: false },
} as const;

export const SYMBOL_INFO_MAP = {
	H1: artStates,
	H2: artStates,
	H3: artStates,
	H4: artStates,
	L1: artStates,
	L2: artStates,
	L3: artStates,
	L4: artStates,
	L5: artStates,
	W: artStates,
	S: artStates,
} as const satisfies Record<string, Record<string, SymbolInfo>>;
