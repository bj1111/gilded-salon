// Paytable and game-rules content for Gilded Salon, as plain data (sections -> heading -> blocks).
// Pure: no SDK imports, so it is unit-tested in node (src/i18n/copy.test.ts). Every number that
// exists in the generated math config is read from it; social wording comes from `copy`.
//
// Requirements this content covers (Stake Engine approval guidelines,
// https://stake-engine.com/docs/approval-guidelines/front-end-communication and
// https://stake-engine.com/docs-content/prompt.md): RTP + max win per mode [25], every symbol's
// pays [24], how wins form [26], mode cost [27], free spins and retriggers [29], a guide to every
// control [235], and the general disclaimer [185].

import config from '../../game/config';
import { DISCLAIMER_SENTENCES, GAME_NAME, copy } from '../../i18n/copyData';

export type SymbolKey = keyof typeof config.symbols;
export type SymbolArtKey = `sym_${SymbolKey}`;
export type PayEntry = { count: number; multiplier: number };
export type SymbolEntry = {
	key: SymbolKey;
	art: SymbolArtKey;
	name: string;
	role?: string;
	pays: PayEntry[];
	description?: string;
};
export type PaylineEntry = { number: number; rows: readonly number[] };

export type Block =
	| { type: 'paragraph'; text: string; tone?: 'disclaimer' }
	| { type: 'list'; items: string[] }
	| { type: 'table'; head: string[]; rows: string[][] }
	| { type: 'controls'; items: { control: string; text: string }[] }
	| { type: 'symbols'; symbols: SymbolEntry[]; showAmounts: boolean }
	// "Amounts are shown for your current bet of …": rendered by the component with the live bet
	// (copy.paysShownAt), so it carries no text here.
	| { type: 'amountNote' }
	| { type: 'paylines'; label: string; lines: PaylineEntry[] };

export type Section = { id: string; heading: string; blocks: Block[] };
export type ModalContent = { title: string; sections: Section[] };

// ------------------------------------------------------------------------------------------------
// Facts
// ------------------------------------------------------------------------------------------------

// Free-spin awards are not part of the exported frontend config; they come from the math
// (math-sdk/games/sticky_fruits/game_config.py `freespin_triggers`), which is final.
export const FREE_SPINS_AWARD: Readonly<Record<number, number>> = { 3: 8, 4: 10, 5: 12 };
export const FREE_SPINS_RETRIGGER = 5;
// Natural free-spin odds per spin (math-sdk/games/sticky_fruits/readme.txt): base reels vs Bonus Hunt reels.
export const FREE_SPINS_ONE_IN = { base: 238, hunt: 51 } as const;

const baseMode = config.betModes.base;
const paylineEntries: PaylineEntry[] = Object.entries(config.paylines)
	.map(([number, rows]) => ({ number: Number(number), rows }))
	.sort((a, b) => a.number - b.number);

/** 1-based reel numbers on which a symbol appears in the given reel set. */
const reelsWith = (symbol: SymbolKey, reelSet: keyof typeof config.paddingReels) =>
	config.paddingReels[reelSet]
		.map((reel, index) => (reel.some((s) => s.name === symbol) ? index + 1 : 0))
		.filter(Boolean);

export const GAME_FACTS = {
	reels: config.numReels,
	rows: config.numRows[0],
	lines: paylineEntries.length,
	cost: baseMode.cost,
	rtp: baseMode.rtp,
	maxWin: baseMode.max_win,
	wildReelsBase: reelsWith('W', 'basegame'),
	wildReelsFree: reelsWith('W', 'freegame'),
};

const withThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 10000 -> "10,000×", 1.5 -> "1.5×" (locale-independent). */
export const formatMultiplier = (value: number) => {
	const [int, frac] = String(value).split('.');
	return `${withThousands(int)}${frac ? `.${frac}` : ''}×`;
};

/** 0.965 -> "96.50%". */
export const formatRtp = (rtp: number) => `${(rtp * 100).toFixed(2)}%`;

const joinWith = (word: string) => (items: (string | number)[]) =>
	items.length <= 1
		? items.join('')
		: `${items.slice(0, -1).join(', ')} ${word} ${items[items.length - 1]}`;
const joinAnd = joinWith('and');
const joinOr = joinWith('or');

// ------------------------------------------------------------------------------------------------
// Symbols
// ------------------------------------------------------------------------------------------------

const SYMBOL_NAMES: Record<SymbolKey, string> = {
	W: 'Golden Chip',
	S: 'Golden Key',
	H1: 'Roulette Wheel',
	H2: 'Brilliant Diamond',
	H3: 'Dice',
	H4: 'Fan of Aces',
	L1: 'Ace',
	L2: 'King',
	L3: 'Queen',
	L4: 'Jack',
	L5: 'Ten',
};

const paysOf = (key: SymbolKey): PayEntry[] =>
	(config.symbols[key].paytable ?? [])
		.flatMap((entry) => Object.entries(entry) as [string, number][])
		.map(([count, multiplier]) => ({ count: Number(count), multiplier }));

const symbolEntry = (key: SymbolKey, extra: Partial<SymbolEntry> = {}): SymbolEntry => ({
	key,
	art: `sym_${key}`,
	name: SYMBOL_NAMES[key],
	pays: paysOf(key),
	...extra,
});

const PAYING_SYMBOLS: SymbolKey[] = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L5'];

// ------------------------------------------------------------------------------------------------
// Wording helpers (social mode swaps restricted words; see copyData.ts)
// ------------------------------------------------------------------------------------------------

const words = (social: boolean) =>
	social
		? {
				bet: 'play amount',
				totalBet: 'total play',
				line: 'line',
				lines: 'lines',
				pay: 'win',
				pays: 'wins',
				Pays: 'Wins',
				paid: 'counted',
			}
		: {
				bet: 'bet',
				totalBet: 'total bet',
				line: 'payline',
				lines: 'paylines',
				pay: 'pay',
				pays: 'pays',
				Pays: 'Pays',
				paid: 'paid',
			};

const freeSpinsSentence = () => {
	const counts = Object.keys(FREE_SPINS_AWARD).map(Number);
	return `${joinOr(counts)} Golden Keys anywhere on the reels trigger ${joinOr(counts.map((n) => FREE_SPINS_AWARD[n]))} Free Spins respectively.`;
};

const retriggerSentence = () =>
	`During Free Spins, 3 or more Golden Keys anywhere retrigger the feature and award ${FREE_SPINS_RETRIGGER} more Free Spins. There is no limit to the number of retriggers.`;

const wildPaysSentence = (social: boolean) => {
	const w = words(social);
	const pays = [...paysOf('W')].sort((a, b) => a.count - b.count);
	return `${joinOr(pays.map((p) => p.count))} Wilds on a ${w.line} also ${w.pay} ${joinOr(pays.map((p) => formatMultiplier(p.multiplier)))} the ${w.totalBet}.`;
};

const wildReelsSentence = () => {
	const base = GAME_FACTS.wildReelsBase;
	const free = GAME_FACTS.wildReelsFree;
	const baseText =
		base.length === GAME_FACTS.reels
			? 'In the base game, Wilds can land on any reel.'
			: `In the base game, Wilds appear on reels ${joinAnd(base)} only.`;
	const freeText =
		free.length === GAME_FACTS.reels
			? `During Free Spins, Wilds can land on all ${GAME_FACTS.reels} reels.`
			: `During Free Spins, Wilds appear on reels ${joinAnd(free)} only.`;
	return `${baseText} ${freeText}`;
};

const disclaimerSection = (): Section => ({
	id: 'disclaimer',
	heading: 'DISCLAIMER',
	blocks: [{ type: 'paragraph', text: DISCLAIMER_SENTENCES.join(' '), tone: 'disclaimer' }],
});

const factsList = (social: boolean): Block => {
	const w = words(social);
	return {
		type: 'list',
		items: [
			`Return to player (RTP): ${formatRtp(GAME_FACTS.rtp)}`,
			`Maximum win: ${formatMultiplier(GAME_FACTS.maxWin)} the ${w.bet} per round`,
		],
	};
};

// ------------------------------------------------------------------------------------------------
// Paytable
// ------------------------------------------------------------------------------------------------

export const payTableContent = (social: boolean): ModalContent => {
	const c = copy(social);
	const w = words(social);

	return {
		title: c.payTableTitle,
		sections: [
			{
				id: 'specials',
				heading: 'SPECIAL SYMBOLS',
				blocks: [
					{ type: 'amountNote' },
					{
						type: 'symbols',
						showAmounts: true,
						symbols: [
							symbolEntry('W', {
								role: 'WILD',
								description: `Substitutes for all symbols except the Golden Key. During Free Spins every Wild that lands stays in place until the Free Spins end.`,
							}),
							symbolEntry('S', {
								role: 'SCATTER',
								description: `${freeSpinsSentence()} ${retriggerSentence()} The Golden Key does not ${w.pay} by itself.`,
							}),
						],
					},
				],
			},
			{
				id: 'pays',
				heading: social ? 'SYMBOL WINS' : 'SYMBOL PAYS',
				blocks: [
					{
						type: 'paragraph',
						text: `${w.Pays} are multiples of the ${w.totalBet} for 3, 4 or 5 matching symbols on a ${w.line}, from left to right. The Golden Chip substitutes for all of them.`,
					},
					{ type: 'symbols', showAmounts: true, symbols: PAYING_SYMBOLS.map((key) => symbolEntry(key)) },
				],
			},
			{
				id: 'lines',
				heading: social ? 'WIN LINES' : 'PAYLINES',
				blocks: [
					{
						type: 'paragraph',
						text: `All ${GAME_FACTS.lines} ${w.lines} are always active. Wins ${social ? 'count' : 'pay'} from left to right on consecutive reels, starting from the leftmost reel. Only the highest win on each ${w.line} is ${w.paid}; wins on different ${w.lines} are added together.`,
					},
					{ type: 'paylines', label: social ? 'Line' : 'Payline', lines: paylineEntries },
				],
			},
			{ id: 'facts', heading: 'RTP & MAXIMUM WIN', blocks: [factsList(social)] },
			disclaimerSection(),
		],
	};
};

// ------------------------------------------------------------------------------------------------
// Bonus features (bought modes and Bonus Hunt); costs come from the exported math config
// ------------------------------------------------------------------------------------------------

const featuresHeading = (social: boolean) => (social ? 'FEATURES' : 'BONUS FEATURES');

const featuresSection = (social: boolean): Section => {
	const c = copy(social);
	const w = words(social);
	const modes = config.betModes as Record<string, { cost: number; rtp: number }>;
	const cost = (mode: string) => formatMultiplier(modes[mode].cost);
	const rtp = (mode: string) => formatRtp(modes[mode].rtp);
	return {
		id: 'features',
		heading: featuresHeading(social),
		blocks: [
			{
				type: 'paragraph',
				text: social
					? `Open ${c.buyButton} beside the reels to see the features. Each is shown in multiples of the play amount and in your balance at the current play amount, and needs a CONFIRM before it starts.`
					: `Press ${c.buyButton} beside the reels to open ${c.menuTitle}. Prices are multiples of the bet, are shown in your currency at the current bet, and every purchase needs a CONFIRM.`,
			},
			{
				type: 'table',
				head: ['MODE', social ? 'PLAY AMOUNT' : 'PRICE', 'RTP'],
				rows: [
					['BASE GAME', cost('base'), rtp('base')],
					[c.bonusName, cost('bonus'), rtp('bonus')],
					[c.superName, cost('super'), rtp('super')],
					[c.huntName, `${cost('hunt')} per spin`, rtp('hunt')],
				],
			},
			{
				type: 'list',
				items: [
					`${c.bonusName}: one spin that always lands 3, 4 or 5 Golden Keys, awarding ${joinOr(Object.values(FREE_SPINS_AWARD))} Free Spins.`,
					`${c.superName}: one spin that always lands 5 Golden Keys for ${FREE_SPINS_AWARD[5]} Free Spins. Before the first Free Spin, 2 Sticky Wilds are placed on random reel positions.`,
					`${c.huntName}: while it is on, every spin is played at ${cost('hunt')} the ${w.bet} and Free Spins land about 1 in ${FREE_SPINS_ONE_IN.hunt} spins instead of 1 in ${FREE_SPINS_ONE_IN.base}. It stays on until you turn it off in the same panel. ${social ? 'Starting one of the other features' : 'Buying a bonus'} switches ${c.huntName} off.`,
					social
						? `A feature started from this panel plays exactly like Free Spins triggered on the reels, with the same symbols, wins and Sticky Wilds, apart from the 2 Sticky Wilds placed at the start of ${c.superName}.`
						: `A purchased round plays exactly like Free Spins triggered on the reels, with the same symbols, pays and Sticky Wilds, apart from the 2 Sticky Wilds placed at the start of ${c.superName}.`,
					`The maximum win of ${formatMultiplier(GAME_FACTS.maxWin)} the ${w.bet} applies in every mode.`,
					`Where these features are not available, ${c.buyButton} is not shown.`,
				],
			},
		],
	};
};

// ------------------------------------------------------------------------------------------------
// Game rules
// ------------------------------------------------------------------------------------------------

export const rulesContent = (social: boolean): ModalContent => {
	const c = copy(social);
	const w = words(social);
	const maxWin = formatMultiplier(GAME_FACTS.maxWin);

	return {
		title: c.rulesTitle,
		sections: [
			{
				id: 'about',
				heading: `ABOUT ${GAME_NAME.toUpperCase()}`,
				blocks: [
					{
						type: 'paragraph',
						text: `${GAME_NAME} is a ${GAME_FACTS.reels}-reel, ${GAME_FACTS.rows}-row video slot with ${GAME_FACTS.lines} fixed ${w.lines}.`,
					},
					{
						type: 'paragraph',
						text: social
							? `In the base game each spin is played for ${formatMultiplier(GAME_FACTS.cost)} the play amount. Three more modes are described under ${featuresHeading(social)}.`
							: `In the base game each spin costs ${formatMultiplier(GAME_FACTS.cost)} the bet. Three more modes are described under ${featuresHeading(social)}.`,
					},
					{
						type: 'paragraph',
						text: `Free Spins are triggered by landing Golden Key Scatters on the reels, or started directly from ${featuresHeading(social)}.`,
					},
				],
			},
			{
				id: 'wins',
				heading: 'HOW WINS FORM',
				blocks: [
					{
						type: 'list',
						items: [
							`Wins ${social ? 'count' : 'pay'} from left to right on consecutive reels, starting from the leftmost reel.`,
							`A win needs 3, 4 or 5 matching symbols on one of the ${GAME_FACTS.lines} ${w.lines}. Wilds count as any symbol except the Scatter.`,
							`All ${GAME_FACTS.lines} ${w.lines} are always active and cannot be changed.`,
							`${w.Pays} are multiples of the ${w.totalBet}; the ${c.payTableTitle} shows every symbol.`,
							`Only the highest win on each ${w.line} is ${w.paid}.`,
							`Wins on different ${w.lines} are added together.`,
							`Scatters do not ${w.pay} anything themselves; they trigger Free Spins.`,
							`Free Spins are played at the ${w.bet} of the spin that triggered them, and their wins are added to that round's total win.`,
						],
					},
				],
			},
			{
				id: 'wild',
				heading: 'WILD · GOLDEN CHIP',
				blocks: [
					{
						type: 'paragraph',
						text: 'The Golden Chip is Wild. It substitutes for all symbols except the Golden Key Scatter.',
					},
					{ type: 'paragraph', text: wildPaysSentence(social) },
					{ type: 'paragraph', text: wildReelsSentence() },
				],
			},
			{
				id: 'freeSpins',
				heading: 'FREE SPINS · THE PRIVATE ROOM',
				blocks: [
					{
						type: 'paragraph',
						text: 'The Golden Key is the Scatter. It can land anywhere on the reels.',
					},
					{
						type: 'table',
						head: ['GOLDEN KEYS', 'FREE SPINS'],
						rows: Object.entries(FREE_SPINS_AWARD).map(([keys, spins]) => [keys, String(spins)]),
					},
					{ type: 'paragraph', text: freeSpinsSentence() },
					{ type: 'paragraph', text: retriggerSentence() },
					{
						type: 'paragraph',
						text: `Free Spins are played on their own set of reels, at the same ${w.bet} as the spin that triggered them.`,
					},
				],
			},
			{
				id: 'sticky',
				heading: 'STICKY WILDS',
				blocks: [
					{
						type: 'list',
						items: [
							'During Free Spins, every Wild that lands becomes a Sticky Wild and stays in place until the Free Spins end.',
							'A reel position held by a Sticky Wild always shows the Wild.',
							'Sticky Wilds substitute exactly like normal Wilds and have no multiplier.',
							`The ${c.chipsOnTheFelt} counter shows how many Sticky Wilds are in place.`,
							'All Sticky Wilds are cleared when the Free Spins end.',
						],
					},
				],
			},
			featuresSection(social),
			{
				id: 'maxWin',
				heading: 'MAXIMUM WIN',
				blocks: [
					{ type: 'paragraph', text: `The maximum win is ${maxWin} the ${w.bet} per round.` },
					{
						type: 'paragraph',
						text: `If the total win of a round reaches ${maxWin}, the round ends immediately, the win is capped at ${maxWin} and any remaining Free Spins are not played.`,
					},
				],
			},
			{
				id: 'rtp',
				heading: 'RETURN TO PLAYER',
				blocks: [
					{
						type: 'paragraph',
						text: `The theoretical return to player (RTP) of the game is ${formatRtp(GAME_FACTS.rtp)} in every game mode. It is a long-term average over a very large number of spins; results of individual sessions vary.`,
					},
					factsList(social),
				],
			},
			{
				id: 'controls',
				heading: 'HOW TO PLAY · CONTROLS',
				blocks: [
					{
						type: 'controls',
						items: [
							{ control: c.spin, text: `Starts a spin at the current ${w.bet}.` },
							{
								control: 'SPACE BAR',
								text: `Does the same as the ${c.spin} / ${c.stop} button. Holding it down keeps playing rounds one after another in turbo until you release it (where turbo is available). While a big-win, free-spin or bonus-complete screen is shown it only skips or closes that screen.`,
							},
							{
								control: c.stop,
								text: `While the reels spin, ${c.spin} turns into ${c.stop}: press it (or the Space bar) to show the result sooner. The result is already decided and does not change.`,
							},
							{
								control: c.tapToSkip,
								text: 'During a win presentation, tap the screen or press the Space bar to jump to the final amount.',
							},
							{
								control: c.autoplay,
								text: `Opens the AUTO SPINS panel. Choose the number of rounds and, under ADVANCED, an optional LOSS LIMIT and SINGLE WIN LIMIT (multiples of the ${w.bet}), then press START AUTOPLAY to confirm. Autoplay never starts from a single press. It stops when the chosen number of rounds has been played, when a limit is reached, when the balance is too low for the next spin, or when you press ${c.autoplay} or ${c.stop}.`,
							},
							{
								control: c.turbo,
								text: 'Turns turbo on or off. Reels stop faster and win presentations are shorter; results are not affected.',
							},
							{
								control: `${c.buyButton} / ${c.huntOn}`,
								text: `Opens ${social ? 'the features panel' : c.menuTitle} (see ${featuresHeading(social)}). It reads ${c.huntOn} while ${c.huntName} is on. Not available during a round or autoplay.`,
							},
							{
								control: `${c.bet} − / +`,
								text: social
									? 'Lowers or raises the play amount one level at a time, within the play amounts available to you.'
									: 'Lowers or raises the bet one level at a time, within the bet levels available to you.',
							},
							{
								control: c.betAmount,
								text: social
									? 'Tap the play amount to open the PLAY AMOUNT panel, choose any available amount and press CONFIRM.'
									: 'Tap the bet amount to open the BET MENU, choose any available bet and press CONFIRM.',
							},
							{ control: c.balance, text: 'Shows your current balance.' },
							{ control: c.win, text: 'Shows the total win of the current round.' },
							{
								control: c.menu,
								text: `Opens the game menu with the ${c.payTableTitle}, the ${c.rulesTitle} and the ${c.settings}.`,
							},
							{
								control: `${c.gameInfo} / ${c.payTableTitle}`,
								text: `Shows what every symbol ${w.pays} at the current ${w.bet}, the special symbols and all ${GAME_FACTS.lines} ${w.lines}.`,
							},
							{
								control: c.rulesTitle,
								text: 'Shows these rules: features, controls, RTP and maximum win.',
							},
							{
								control: c.settings,
								text: 'Adjusts the master, music and sound effect volume.',
							},
							{
								control: c.sound,
								text: `Turns all game sound, music and effects, on or off (${c.soundOn} / ${c.soundOff}).`,
							},
							{
								control: `× ${c.close}`,
								text: 'Closes a panel. You can also press Escape or tap outside the panel.',
							},
							{
								control: c.freeSpins,
								text: `During Free Spins the crest shows the spins played and awarded (for example ${c.freeSpinsCounter(3, 8)}) and ${c.chipsOnTheFelt} shows how many Sticky Wilds are in place.`,
							},
							{
								control: `${c.play} / ${c.playAgain}`,
								text: social
									? `In a replay, ${c.play} shows the recorded round and ${c.playAgain} shows it again. The play amount cannot be changed in a replay.`
									: `In a replay, ${c.play} shows the recorded round and ${c.playAgain} shows it again. Betting is not available in a replay.`,
							},
						],
					},
				],
			},
			disclaimerSection(),
		],
	};
};

// ------------------------------------------------------------------------------------------------
// Flattening (tests, search)
// ------------------------------------------------------------------------------------------------

const blockText = (block: Block): string[] => {
	switch (block.type) {
		case 'paragraph':
			return [block.text];
		case 'list':
			return block.items;
		case 'table':
			return [...block.head, ...block.rows.flat()];
		case 'controls':
			return block.items.flatMap((item) => [item.control, item.text]);
		case 'symbols':
			return block.symbols.flatMap((s) => [
				s.name,
				s.role ?? '',
				s.description ?? '',
				...s.pays.flatMap((p) => [String(p.count), formatMultiplier(p.multiplier)]),
			]);
		case 'paylines':
			return block.lines.map((line) => `${block.label} ${line.number}`);
		case 'amountNote':
			return [];
	}
};

/** Every visible text string of a modal (amounts in currency are added by the component). */
export const contentText = (content: ModalContent): string[] =>
	[
		content.title,
		...content.sections.flatMap((section) => [section.heading, ...section.blocks.flatMap(blockText)]),
	].filter((text) => text.length > 0);
