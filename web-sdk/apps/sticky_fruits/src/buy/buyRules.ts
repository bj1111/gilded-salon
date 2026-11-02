// Pure rules for the bought features (Buy Free Spins, Buy Super Free Spins, Bonus Hunt).

export type BuyMode = 'BONUS' | 'SUPER' | 'HUNT';

// cents are the finest unit we show; anything smaller in bet × cost is float noise
const EPSILON = 1e-9;

export const buyPrice = (cost: number, bet: number) => bet * cost;

// The SDK only checks bet × cost against the balance for 'activate' modes, so a buy checks here.
export const canAfford = (cost: number, bet: number, balance: number) =>
	bet > 0 && buyPrice(cost, bet) <= balance + EPSILON;

export const buyAvailable = (jurisdiction: { disabledBuyFeature?: boolean } | undefined, replay: boolean) =>
	!replay && !jurisdiction?.disabledBuyFeature;

export const huntActive = (activeBetModeKey: string) => activeBetModeKey.toUpperCase() === 'HUNT';

// The BUY BONUS plaque: wherever buying is available, except while free spins are running.
export const buyButtonShown = (
	jurisdiction: { disabledBuyFeature?: boolean } | undefined,
	replay: boolean,
	gameType: string,
) => buyAvailable(jurisdiction, replay) && gameType !== 'freegame';
