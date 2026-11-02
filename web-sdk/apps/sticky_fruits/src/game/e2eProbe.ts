import { stateBet, stateConfig, stateUi } from 'state-shared';

import { stateGame } from './stateGame.svelte';
import { eventEmitter } from './eventEmitter';
import { stateBuy } from '../buy/stateBuy.svelte';
import { buyButtonShown } from '../buy/buyRules';

// Read-only view of game state for tools/e2e.mjs, installed only when the launch URL has e2e=1
// (never by the RGS / Stake launcher). It reads state; it cannot change the game or the round.
export const installE2eProbe = () => {
	if (typeof window === 'undefined' || new URLSearchParams(location.search).get('e2e') !== '1') return;
	// every cell a chip-drop animation has played on since this page loaded
	const dropped: string[] = [];
	eventEmitter.subscribeOnMount({
		stickyWildsLock: ({ positions }: { positions: { reel: number; row: number }[] }) =>
			void dropped.push(...positions.map(({ reel, row }) => `${reel}-${row}`)),
	});
	Object.defineProperty(window, '__gildedSalon', {
		value: Object.freeze({
			state: () => ({
				stickyWilds: stateGame.stickyWilds.length,
				stickyCells: stateGame.stickyWilds.map(({ reel, row }) => `${reel}-${row}`),
				freeSpinsTotal: stateUi.freeSpinCounterTotal,
				gameType: stateGame.gameType,
				mode: stateBet.activeBetModeKey,
				buyMenuOpen: stateBuy.open,
				buyButtonShown: buyButtonShown(stateConfig.jurisdiction, stateUi.config.mode === 'replay', stateGame.gameType),
				droppedCells: [...dropped],
			}),
		}),
	});
};
