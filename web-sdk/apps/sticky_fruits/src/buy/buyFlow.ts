import { canAfford, type BuyMode } from './buyRules';

// What happens when the player confirms a buy or flips Bonus Hunt. Pure: the menu passes in the
// state writers, so the order (mode first, then the bet) is pinned by buyFlow.test.ts.

export type BuyContext = {
	cost: number;
	bet: number;
	balance: number;
	setMode: (key: string) => void;
	clearConfirm: () => void;
	broadcastBet: () => void;
};

/** Starts a bought round. Returns false (and does nothing) when the balance cannot cover it. */
export const startBuy = (mode: Exclude<BuyMode, 'HUNT'>, ctx: BuyContext) => {
	if (!canAfford(ctx.cost, ctx.bet, ctx.balance)) return false;
	ctx.setMode(mode);
	ctx.clearConfirm();
	ctx.broadcastBet();
	return true;
};

/** Bonus Hunt only changes the mode; the next spin is charged at its cost. */
export const setHunt = (on: boolean, setMode: (key: string) => void) => setMode(on ? 'HUNT' : 'BASE');
