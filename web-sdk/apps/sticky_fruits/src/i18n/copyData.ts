// Player-facing wording for Gilded Salon, as pure data (no SDK imports, so node unit tests can
// load it). `copy.ts` re-exports this and adds the SDK-reading `isSocial()`.
//
// Social mode (Stake.US, `social=true`): every restricted phrase below must be replaced. The
// table is copied verbatim from the Stake Engine approval guidelines:
//   https://stake-engine.com/docs/approval-guidelines/jurisdiction-requirements
//   (also reproduced in https://stake-engine.com/docs-content/prompt.md, "Social mode")
// Matching is whole-word and case-insensitive, anywhere a player can see the text.

export type RestrictedPhrase = { restricted: string; replacement: string };

export const RESTRICTED_PHRASES: readonly RestrictedPhrase[] = [
	{ restricted: 'at the cost of', replacement: 'for' },
	{ restricted: 'be awarded to player’s accounts', replacement: 'appear in player’s accounts' },
	{ restricted: 'bet', replacement: 'play' },
	{ restricted: 'bet/s', replacement: 'play/s' },
	{ restricted: 'betting', replacement: 'play / playing' },
	{ restricted: 'bets', replacement: 'plays' },
	{ restricted: 'bonus buy', replacement: 'bonus / feature' },
	{ restricted: 'bought', replacement: 'instantly triggered' },
	{ restricted: 'buy', replacement: 'play' },
	{ restricted: 'buy bonus', replacement: 'get bonus' },
	{ restricted: 'cash', replacement: 'coins' },
	{ restricted: 'cost of', replacement: 'can be played for' },
	{ restricted: 'credit', replacement: 'coins' },
	{ restricted: 'currency', replacement: 'token' },
	{ restricted: 'deposit', replacement: 'get coins' },
	{ restricted: 'fund', replacement: 'balance' },
	{ restricted: 'gamble', replacement: 'play' },
	{ restricted: 'money', replacement: 'coins' },
	{ restricted: 'paid', replacement: 'won' },
	{ restricted: 'paid out', replacement: 'win' },
	{ restricted: 'pay', replacement: 'win' },
	{ restricted: 'pay out', replacement: 'win / won' },
	{ restricted: 'payer', replacement: 'winner' },
	{ restricted: 'pays', replacement: 'wins' },
	{ restricted: 'pays out', replacement: 'won' },
	{ restricted: 'place your bets', replacement: 'come and play / join in the game' },
	{ restricted: 'purchase', replacement: 'play' },
	{ restricted: 'rebet', replacement: 'respin' },
	{ restricted: 'stake', replacement: 'play amount' },
	{ restricted: 'total bet', replacement: 'total play' },
	{ restricted: 'wager', replacement: 'play' },
	{ restricted: 'withdraw', replacement: 'redeem' },
	{ restricted: 'win feature', replacement: 'play feature' },
];

// Not in the table, but forms of the same words that a reviewer would flag. The review prompt
// calls out "Pay table" / "Paytable" explicitly ("pay" is restricted); the rest follow the same
// logic and are kept out of social text to be safe.
export const RESTRICTED_VARIANTS: readonly string[] = [
	'paytable',
	'paytables',
	'pay table',
	'payline',
	'paylines',
	'payout',
	'payouts',
	'paying',
	'payment',
	'payments',
	'payable',
	'betted',
	'bettor',
	'rebets',
	'buys',
	'buying',
	'buyer',
	'purchases',
	'purchased',
	'purchasing',
	'stakes',
	'staked',
	'staking',
	'wagers',
	'wagered',
	'wagering',
	'gambles',
	'gambled',
	'gambling',
	'gambler',
	'cashout',
	'cashed',
	'credits',
	'credited',
	'deposits',
	'deposited',
	'funds',
	'funded',
	'funding',
	'withdrawal',
	'withdrawn',
	'currencies',
];

// General disclaimer, verbatim from the Stake Engine template ("Reviewers check that it covers
// every point in the template"):
//   https://stake-engine.com/docs/approval-guidelines/general-disclaimer
// It contains no restricted phrase, so it is identical in social mode.
export const DISCLAIMER_SENTENCES: readonly string[] = [
	'Malfunction voids all wins and plays.',
	'A consistent internet connection is required.',
	'In the event of a disconnection, reload the game to finish any uncompleted rounds.',
	'The expected return is calculated over many plays.',
	'The game display is not representative of any physical device and is for illustrative purposes only.',
	'Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser.',
	'TM and © 2026 Engine.',
];

export const GAME_NAME = 'Gilded Salon';

type Arg = string | number;

/**
 * Every player-visible HUD / modal string. Values are strings, or functions of string/number
 * arguments for counters and amounts. Both variants have exactly the same keys.
 */
export const copy = (social: boolean) => ({
	gameName: 'GILDED SALON',

	// HUD rail
	balance: 'BALANCE',
	win: 'WIN',
	totalWin: 'TOTAL WIN',
	bet: social ? 'PLAY' : 'BET',
	totalBet: social ? 'TOTAL PLAY' : 'TOTAL BET',
	betAmount: social ? 'PLAY AMOUNT' : 'BET AMOUNT',
	decreaseBet: social ? 'LOWER PLAY AMOUNT' : 'DECREASE BET',
	increaseBet: social ? 'RAISE PLAY AMOUNT' : 'INCREASE BET',
	spin: 'SPIN',
	stop: 'STOP',
	autoplay: 'AUTOPLAY',
	stopAutoplay: 'STOP AUTOPLAY',
	turbo: 'TURBO',
	menu: 'MENU',
	gameInfo: 'GAME INFO',
	payTableTitle: social ? 'WIN TABLE' : 'PAYTABLE',
	rulesTitle: 'GAME RULES',
	settings: 'SETTINGS',
	sound: 'SOUND',
	soundOn: 'SOUND ON',
	soundOff: 'SOUND OFF',
	close: 'CLOSE',
	insufficientBalance: social
		? 'NOT ENOUGH BALANCE FOR THIS PLAY AMOUNT'
		: 'INSUFFICIENT BALANCE FOR THIS BET',

	// loader
	loading: 'LOADING',
	tapToEnter: 'TAP TO ENTER',

	// free spins: "The Private Room"
	freeSpins: 'FREE SPINS',
	of: 'OF',
	freeSpinsCounter: (current: Arg, total: Arg) => `FREE SPINS ${current} OF ${total}`,
	freeSpinsAwarded: (count: Arg) => `${count} FREE SPINS`,
	privateRoom: 'THE PRIVATE ROOM',
	wildsStay: 'WILD CHIPS STAY ON THE FELT',
	chipsOnTheFelt: 'CHIPS ON THE FELT',
	retrigger: (count: Arg) => `+${count} FREE SPINS`,
	bonusWin: 'BONUS WIN',
	bonusComplete: 'BONUS COMPLETE',
	youWon: 'YOU WON',
	tapToStart: 'TAP TO START',
	tapToContinue: 'TAP TO CONTINUE',
	tapToSkip: 'TAP TO SKIP',

	// bought features: Buy Free Spins, Buy Super Free Spins, Bonus Hunt
	buyButton: social ? 'FEATURES' : 'BUY BONUS',
	huntOn: 'HUNT ON',
	menuTitle: social ? 'FEATURES' : 'THE CASHIER',
	bonusName: 'THE PRIVATE ROOM',
	superName: 'THE HIGH-ROLLER ROOM',
	huntName: 'BONUS HUNT',
	bonusDesc: 'Go straight to 8, 10 or 12 free spins with sticky wild chips.',
	superDesc: '12 free spins with 2 wild chips locked on the felt from the start.',
	huntDesc: social
		? 'Every spin uses a higher play amount. Free spins land far more often.'
		: 'Every spin costs more. Free spins land far more often.',
	perSpin: (amount: Arg) => `${amount} PER SPIN`,
	buyAction: social ? 'PLAY' : 'BUY',
	turnOn: 'TURN ON',
	turnOff: 'TURN OFF',
	confirmBuy: (name: Arg, amount: Arg) => (social ? `Play ${name} for ${amount}?` : `Buy ${name} for ${amount}?`),
	confirm: 'CONFIRM',
	back: 'BACK',
	tooLow: 'BALANCE TOO LOW',
	huntBetLabel: (multiplier: Arg) => (social ? `PLAY ×${multiplier}` : `BET ×${multiplier}`),
	huntRibbon: 'BONUS HUNT',

	// win tiers
	bigWin: 'BIG WIN',
	grandWin: 'GRAND WIN',
	megaWin: 'MEGA WIN',
	legendary: 'LEGENDARY',
	maxWin: 'MAX WIN',

	// replay
	replay: 'REPLAY',
	play: 'PLAY',
	playAgain: 'PLAY AGAIN',
	replayAmount: (amount: Arg) => (social ? `PLAY AMOUNT ${amount}` : `BET ${amount}`),

	// paytable / rules modals
	paysShownAt: (amount: Arg) =>
		social
			? `Amounts are shown for your current play amount of ${amount}.`
			: `Amounts are shown for your current bet of ${amount}.`,
	ofAKind: (count: Arg) => `${count} of a kind`,
	lineNumber: (n: Arg) => (social ? `Line ${n}` : `Payline ${n}`),
	version: 'VERSION',
});

export type Copy = ReturnType<typeof copy>;

/**
 * Social replacements for the SDK's own lingui message ids (ModalBetMenu, ModalAutoSpinMessage,
 * components-ui-pixi labels). Keys are the SDK's English ids; `applySocialSdkWording()` in
 * copy.ts loads them into the active catalogue when social mode is on. The unit test scans the
 * SDK sources and fails if a new id containing a restricted word has no entry here.
 */
export const socialSdkMessages: Record<string, string> = {
	BET: 'PLAY',
	'BET MENU': 'PLAY AMOUNT',
	'SELECT YOUR BET': 'SELECT YOUR PLAY AMOUNT',
	'BUY BONUS': 'GET BONUS',
	PAYTABLE: 'WIN TABLE',
	'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.':
		'NOT ENOUGH BALANCE FOR THIS PLAY. PLEASE GET COINS OR LOWER THE PLAY AMOUNT.',
};
