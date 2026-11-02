import type { BuyMode } from './buyRules';

// Buy menu visibility and the option waiting for CONFIRM.
export const stateBuy = $state({
	open: false,
	confirming: null as Exclude<BuyMode, 'HUNT'> | null,
});
