import _ from 'lodash';
import type { Tween } from 'svelte/motion';

import { stateBet } from 'state-shared';
import { createEnhanceBoard, createReelForSpinning } from 'utils-slots';

import type { GameType, RawSymbol, SymbolState, Position } from './types';
import { gameLayout } from './stateLayout';
import { eventEmitter } from './eventEmitter';
import {
	SYMBOL_SIZE,
	BOARD_SIZES,
	INITIAL_BOARD,
	BOARD_DIMENSIONS,
	SPIN_OPTIONS_DEFAULT,
	SPIN_OPTIONS_FAST,
	INITIAL_SYMBOL_STATE,
} from './constants';

// Landing feedback only for the three visible rows (the math pads each reel with a hidden symbol
// above and below; those must not ring or count as landed keys).
const onReelLand = (reelIndex: number, rawSymbol: RawSymbol) => {
	if (rawSymbol.name !== 'S' && rawSymbol.name !== 'W') return;
	const symbols = board[reelIndex]?.reelState.symbols ?? [];
	const row = symbols.findIndex((reelSymbol) => reelSymbol.rawSymbol === rawSymbol);
	if (row < 1 || row > BOARD_DIMENSIONS.y) return;
	// a chip already locked on the felt rang when it landed; it does not land again
	if (stateGame.stickyWilds.some((wild) => wild.reel === reelIndex && wild.row === row)) return;
	if (rawSymbol.name === 'S') {
		stateGame.scatterCounter += 1;
		eventEmitter.broadcast({ type: 'sfx', name: 'keyLand', index: Math.min(5, stateGame.scatterCounter) });
	} else {
		eventEmitter.broadcast({ type: 'sfx', name: 'wildLand' });
	}
	eventEmitter.broadcast({ type: 'symbolLanded', reel: reelIndex, row: row - 1, name: rawSymbol.name });
};

const board = _.range(BOARD_DIMENSIONS.x).map((reelIndex) => {
	const reel = createReelForSpinning({
		reelIndex,
		symbolHeight: SYMBOL_SIZE,
		initialSymbols: INITIAL_BOARD[reelIndex],
		initialSymbolState: INITIAL_SYMBOL_STATE,
		onReelStopping: () => {
			eventEmitter.broadcast({ type: 'sfx', name: 'reelStop', index: reelIndex });
			eventEmitter.broadcast({ type: 'reelLanded', reel: reelIndex });
		},
		onSymbolLand: ({ rawSymbol }) => onReelLand(reelIndex, rawSymbol),
	});

	reel.reelState.spinOptions = () =>
		reel.reelState.spinType === 'fast' ? SPIN_OPTIONS_FAST : SPIN_OPTIONS_DEFAULT;

	return reel;
});

export type Reel = (typeof board)[number];
export type ReelSymbol = Reel['reelState']['symbols'][number];

export type MultiplierSymbol = {
	initX: number;
	initY: number;
	symbolX: Tween<number>;
	symbolY: Tween<number>;
	rawSymbol: RawSymbol;
	symbolState: SymbolState;
	oncomplete: () => void;
};

export const stateGame = $state({
	board,
	gameType: 'basegame' as GameType,
	multiplierBoard: [] as (MultiplierSymbol | undefined)[][],
	scatterCounter: 0,
	// free-spin wilds locked in place; rows are padded board rows, as sent by the math
	stickyWilds: [] as Position[],
	// when the current round was requested; some jurisdictions set a minimum round duration
	roundStartedAt: 0,
});

// Canvas position and scale of the 600 x 360 board (board units are SYMBOL_SIZE per cell).
const boardLayout = () => {
	const { board } = gameLayout();
	return {
		x: board.x,
		y: board.y,
		scale: board.scale,
		pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
		...BOARD_SIZES,
	};
};

const boardRaw = () =>
	board.map((reel) => reel.reelState.symbols.map((reelSymbol) => reelSymbol.rawSymbol));

const { enhanceBoard } = createEnhanceBoard();
const enhancedBoard = enhanceBoard({ board: stateGame.board });

export const stateGameDerived = {
	boardLayout,
	boardRaw,
	enhancedBoard,
};
