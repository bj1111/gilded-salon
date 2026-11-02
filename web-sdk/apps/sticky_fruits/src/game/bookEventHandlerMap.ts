import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateUi, stateUrlDerived } from 'state-shared';

import { eventEmitter } from './eventEmitter';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import { stateXstateDerived } from './stateXstate';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';
import config from './config';
import { isTakeover, tierForAmount } from '../presentation/winTiers';
import { winCells } from '../presentation/paylines';

// Every handler only presents what the book says; amounts, boards and positions come straight
// from the events. Handlers are awaited in order, so the round is not released before the
// presentation that belongs to it has finished.

// shorter presentations when the player asked for speed
const fast = () => stateBet.isTurbo || stateXstateDerived.isAutoBetting();

const animateSymbols = async ({ positions }: { positions: Position[] }) => {
	eventEmitter.broadcast({ type: 'boardShow' });
	await eventEmitter.broadcastAsync({ type: 'boardWithAnimateSymbols', symbolPositions: positions });
};

const presentWin = async (amount: number) => {
	const tier = tierForAmount(amount);
	if (tier === 'none') return;
	if (isTakeover(tier)) {
		await eventEmitter.broadcastAsync({ type: 'winTakeover', amount, fast: fast() });
	} else {
		await eventEmitter.broadcastAsync({ type: 'winPlaque', amount, tier, fast: fast() });
	}
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		if (isBonusGame) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
			// replays must not talk to the wallet/bet endpoints
			if (!stateUrlDerived.replay()) recordBookEvent({ bookEvent });
		}

		eventEmitter.broadcast({ type: 'winLinesHide' });
		stateGame.scatterCounter = 0;
		stateGame.gameType = bookEvent.gameType;
		// base-game rounds start spinning on the button press (actor.ts); free spins start here
		if (bookEvent.gameType === 'freegame') eventEmitter.broadcast({ type: 'sfx', name: 'reelStart' });
		await stateGameDerived.enhancedBoard.spin({
			revealEvent: bookEvent,
			paddingBoard: config.paddingReels[bookEvent.gameType],
		});
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		const lines = bookEvent.wins.map((win) => _.sortBy(winCells(win), (cell) => cell.reel));
		const positions = _.uniqBy(
			bookEvent.wins.flatMap((win) => win.positions),
			(position) => `${position.reel}-${position.row}`,
		);
		eventEmitter.broadcast({ type: 'sfx', name: 'lineTrace' });
		eventEmitter.broadcast({
			type: 'winLinesShow',
			lines,
			cells: positions.map(({ reel, row }) => ({ reel, row: row - 1 })),
		});
		await animateSymbols({ positions });
	},
	wincap: async (bookEvent: BookEventOfType<'wincap'>) => {
		// The math stops the round at the max win; the remaining free spins are not played.
		stateBet.winBookEventAmount = bookEvent.amount;
	},
	newStickyWilds: async (bookEvent: BookEventOfType<'newStickyWilds'>) => {
		stateGame.stickyWilds = [...stateGame.stickyWilds, ...bookEvent.newWilds];
		await eventEmitter.broadcastAsync({ type: 'stickyWildsLock', positions: bookEvent.newWilds });
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
	},
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		// the keys celebrate, the curtains draw in, and the private room opens
		eventEmitter.broadcast({ type: 'sfx', name: 'retrigger' });
		await animateSymbols({ positions: bookEvent.positions });
		eventEmitter.broadcast({ type: 'winLinesHide' });
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		eventEmitter.broadcast({ type: 'sfx', name: 'curtains' });
		await eventEmitter.broadcastAsync({ type: 'curtainsClose' });
		stateGame.gameType = 'freegame';
		eventEmitter.broadcast({ type: 'music', track: 'private' });
		eventEmitter.broadcast({ type: 'sfx', name: 'freeSpinsIntro' });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinIntro',
			totalFreeSpins: bookEvent.totalFs,
			auto: stateXstateDerived.isAutoBetting(),
		});
		eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
		stateUi.freeSpinCounterShow = true;
		stateUi.freeSpinCounterCurrent = 0;
		stateUi.freeSpinCounterTotal = bookEvent.totalFs;
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
	},
	updateFreeSpin: async (bookEvent: BookEventOfType<'updateFreeSpin'>) => {
		// the math counts spins already played (0-based)
		stateUi.freeSpinCounterShow = true;
		stateUi.freeSpinCounterCurrent = bookEvent.amount + 1;
		stateUi.freeSpinCounterTotal = bookEvent.total;
	},
	freeSpinRetrigger: async (bookEvent: BookEventOfType<'freeSpinRetrigger'>) => {
		const added = bookEvent.totalFs - stateUi.freeSpinCounterTotal;
		eventEmitter.broadcast({ type: 'sfx', name: 'retrigger' });
		await animateSymbols({ positions: bookEvent.positions });
		await eventEmitter.broadcastAsync({ type: 'retriggerBanner', added, fast: fast() });
		stateUi.freeSpinCounterTotal = bookEvent.totalFs;
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		eventEmitter.broadcast({ type: 'winLinesHide' });
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		if (isTakeover(tierForAmount(bookEvent.amount))) {
			await eventEmitter.broadcastAsync({ type: 'winTakeover', amount: bookEvent.amount, fast: fast() });
		}
		eventEmitter.broadcast({ type: 'sfx', name: 'bonusEnd' });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinOutro',
			amount: bookEvent.amount,
			fast: fast(),
			auto: stateXstateDerived.isAutoBetting(),
		});
		// the croupier rakes the chips off the felt, the curtains open, back to the salon
		await eventEmitter.broadcastAsync({ type: 'chipsSweep' });
		stateGame.stickyWilds = [];
		stateUi.freeSpinCounterShow = false;
		stateUi.freeSpinCounterTotal = 0;
		eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
		stateGame.gameType = 'basegame';
		eventEmitter.broadcast({ type: 'music', track: 'base' });
		eventEmitter.broadcast({ type: 'sfx', name: 'curtains' });
		await eventEmitter.broadcastAsync({ type: 'curtainsOpen' });
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
	},
	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		await presentWin(bookEvent.amount);
	},
	finalWin: async () => {
		// nothing to show: setWin / freeSpinEnd already presented the amounts
	},
	// customised: restores an interrupted bonus in place, without replaying its animations
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;

		function findLastBookEvent<T>(type: T) {
			return _.findLast(bookEvents, (bookEvent) => bookEvent.type === type) as BookEventOfType<T> | undefined;
		}

		const trigger = findLastBookEvent('freeSpinTrigger' as const);
		const update = findLastBookEvent('updateFreeSpin' as const);
		const retrigger = findLastBookEvent('freeSpinRetrigger' as const);
		const totalWin = findLastBookEvent('setTotalWin' as const);

		if (trigger) {
			stateGame.gameType = 'freegame';
			eventEmitter.broadcast({ type: 'curtainsSet', closed: true });
			eventEmitter.broadcast({ type: 'music', track: 'private' });
			eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
			stateUi.freeSpinCounterShow = true;
			stateUi.freeSpinCounterTotal = update?.total ?? retrigger?.totalFs ?? trigger.totalFs;
			stateUi.freeSpinCounterCurrent = update ? update.amount + 1 : 0;
			// a retrigger after the last counter update raised the total further
			if (retrigger && retrigger.index > (update?.index ?? -1)) stateUi.freeSpinCounterTotal = retrigger.totalFs;
		}
		if (totalWin) stateBet.winBookEventAmount = totalWin.amount;
		// every wild already locked before the interruption
		stateGame.stickyWilds = bookEvents.flatMap((bookEvent) =>
			bookEvent.type === 'newStickyWilds' ? bookEvent.newWilds : [],
		);
	},
};
