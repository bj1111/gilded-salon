/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import config from '../game/config';
import {
	DISCLAIMER_SENTENCES,
	RESTRICTED_PHRASES,
	RESTRICTED_VARIANTS,
	copy,
	socialSdkMessages,
} from './copyData';
import { contentText, payTableContent, rulesContent, type ModalContent } from '../ui/modals/content';

// ---------------------------------------------------------------------------------------------
// Independent matcher (deliberately not shared with the app code, so a bug there can't hide here).
// Whole words, case-insensitive; spaces in a phrase match any whitespace; straight and curly
// apostrophes are equivalent.
// ---------------------------------------------------------------------------------------------
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const phraseRegex = (phrase: string) =>
	new RegExp(
		`(?<![\\p{L}\\p{N}])${escape(phrase).replace(/\s+/g, '\\s+').replace(/['’]/g, "['’]")}(?![\\p{L}\\p{N}])`,
		'iu',
	);
const forbidden = [...RESTRICTED_PHRASES.map((p) => p.restricted), ...RESTRICTED_VARIANTS];
const restrictedIn = (text: string) => forbidden.filter((phrase) => phraseRegex(phrase).test(text));

type CopyValue = string | ((...args: string[]) => string);
const SAMPLE_ARGS = ['7', '12'];
const copyStrings = (c: Record<string, CopyValue>) =>
	Object.entries(c).map(([key, value]) => ({
		key,
		text: typeof value === 'function' ? value(...SAMPLE_ARGS) : value,
	}));

const allContent = (social: boolean): ModalContent[] => [payTableContent(social), rulesContent(social)];
const joined = (content: ModalContent) => contentText(content).join('\n');

describe('restricted phrase table', () => {
	it('is the full Stake Engine jurisdiction table (33 rows) with replacements', () => {
		expect(RESTRICTED_PHRASES).toHaveLength(33);
		const map = Object.fromEntries(RESTRICTED_PHRASES.map((p) => [p.restricted, p.replacement]));
		expect(map['bet']).toBe('play');
		expect(map['total bet']).toBe('total play');
		expect(map['stake']).toBe('play amount');
		expect(map['pay']).toBe('win');
		expect(map['buy bonus']).toBe('get bonus');
		expect(map['win feature']).toBe('play feature');
	});

	it('matcher catches the common misses', () => {
		expect(restrictedIn('Total Bet')).toContain('total bet');
		expect(restrictedIn('PAYTABLE')).toContain('paytable');
		expect(restrictedIn('Line pays')).toContain('pays');
		expect(restrictedIn('Place your bets!')).toContain('place your bets');
		expect(restrictedIn('Insufficient funds')).toContain('funds');
		expect(restrictedIn('between better alphabet')).toEqual([]);
	});
});

describe('copy (HUD / modal strings)', () => {
	it('(a) social copy contains no restricted word', () => {
		const hits = copyStrings(copy(true))
			.map(({ key, text }) => ({ key, text, hits: restrictedIn(text) }))
			.filter((x) => x.hits.length > 0);
		expect(hits).toEqual([]);
	});

	it('(b) both variants define the same keys with the same value kinds', () => {
		const a = copy(false);
		const b = copy(true);
		expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
		for (const key of Object.keys(a) as (keyof typeof a)[]) {
			expect(typeof b[key], key).toBe(typeof a[key]);
		}
	});

	it('the social switch actually changes the restricted labels', () => {
		expect(copy(false).bet).toBe('BET');
		expect(copy(true).bet).toBe('PLAY');
		expect(copy(false).totalBet).toBe('TOTAL BET');
		expect(copy(true).totalBet).toBe('TOTAL PLAY');
		expect(copy(false).payTableTitle).toBe('PAYTABLE');
		expect(restrictedIn(copy(true).payTableTitle)).toEqual([]);
	});

	it('every string is non-empty and player-facing name is Gilded Salon', () => {
		for (const social of [false, true]) {
			for (const { key, text } of copyStrings(copy(social))) {
				expect(text.trim().length, key).toBeGreaterThan(0);
				expect(text, key).not.toMatch(/sticky fruits|undefined|NaN|\{|\}/i);
			}
			expect(copy(social).gameName).toBe('GILDED SALON');
		}
	});

	it('has the HUD strings the presentation needs', () => {
		const c = copy(false);
		expect(c.tapToEnter).toBe('TAP TO ENTER');
		expect(c.retrigger('5')).toBe('+5 FREE SPINS');
		expect([c.bigWin, c.grandWin, c.megaWin, c.legendary, c.maxWin]).toEqual([
			'BIG WIN',
			'GRAND WIN',
			'MEGA WIN',
			'LEGENDARY',
			'MAX WIN',
		]);
	});
});

describe('social overrides for SDK modal strings', () => {
	// Every lingui message id the SDK packages translate, read from source so new ids are caught.
	const sources = import.meta.glob<string>('../../../../packages/*/src/**/*.{ts,svelte}', {
		query: '?raw',
		import: 'default',
		eager: true,
	});
	const sdkIds = [
		...new Set(
			Object.values(sources).flatMap((source) =>
				[...source.matchAll(/translate\('([^']*)'\)/g)].map((m) => m[1]),
			),
		),
	];

	it('finds the SDK message ids', () => {
		expect(sdkIds).toContain('SELECT YOUR BET');
	});

	it('overrides every SDK id that contains a restricted word, with clean text', () => {
		const offending = sdkIds.filter((id) => restrictedIn(id).length > 0);
		expect(offending.length).toBeGreaterThan(0);
		for (const id of offending) {
			expect(socialSdkMessages[id], id).toBeTypeOf('string');
		}
		for (const [id, text] of Object.entries(socialSdkMessages)) {
			expect(restrictedIn(text), id).toEqual([]);
		}
	});
});

describe('paytable + rules content', () => {
	it('(a) social content contains no restricted word', () => {
		for (const content of allContent(true)) {
			const hits = contentText(content)
				.map((text) => ({ text, hits: restrictedIn(text) }))
				.filter((x) => x.hits.length > 0);
			expect(hits, content.title).toEqual([]);
		}
	});

	it('(c) states RTP 96.50% and max win 10,000× in both modals, both modes', () => {
		expect(config.betModes.base.rtp).toBe(0.965);
		expect(config.betModes.base.max_win).toBe(10000);
		for (const social of [false, true]) {
			for (const content of allContent(social)) {
				expect(joined(content)).toContain('96.50%');
				expect(joined(content)).toContain('10,000×');
			}
		}
	});

	it('(c) the paytable draws all 20 paylines, numbered 1-20, matching config', () => {
		for (const social of [false, true]) {
			const blocks = payTableContent(social).sections.flatMap((s) => s.blocks);
			const lines = blocks.flatMap((b) => (b.type === 'paylines' ? b.lines : []));
			expect(lines.map((l) => l.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
			for (const line of lines) {
				expect(line.rows).toEqual(config.paylines[String(line.number) as keyof typeof config.paylines]);
			}
		}
	});

	it('lists every paying symbol with 3/4/5 pays read from config', () => {
		const blocks = payTableContent(false).sections.flatMap((s) => s.blocks);
		const symbols = blocks.flatMap((b) => (b.type === 'symbols' ? b.symbols : []));
		const keys = symbols.map((s) => s.key);
		expect(keys).toEqual(['W', 'S', 'H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L5']);
		for (const symbol of symbols) {
			expect(symbol.art).toBe(`sym_${symbol.key}`);
			const table = config.symbols[symbol.key].paytable;
			if (!table) {
				expect(symbol.pays).toEqual([]);
				continue;
			}
			const expected = table
				.flatMap((entry) => Object.entries(entry))
				.map(([count, multiplier]) => ({ count: Number(count), multiplier }));
			expect(symbol.pays).toEqual(expected);
		}
		const h4 = symbols.find((s) => s.key === 'H4')!;
		expect(h4.pays).toEqual([
			{ count: 5, multiplier: 20 },
			{ count: 4, multiplier: 5 },
			{ count: 3, multiplier: 1.5 },
		]);
	});

	it('explains free spins, retrigger, sticky wilds and how wins form', () => {
		for (const social of [false, true]) {
			const text = joined(rulesContent(social));
			for (const needle of ['8', '10', '12', '5 more Free Spins', 'Sticky', 'left to right', 'no multiplier', 'Scatter', 'Wild']) {
				expect(text, needle).toContain(needle);
			}
			expect(text).toMatch(/reels 2, 3 and 4/);
		}
	});

	it('has a guide entry for every UI control', () => {
		for (const social of [false, true]) {
			const c = copy(social);
			const blocks = rulesContent(social).sections.flatMap((s) => s.blocks);
			const controls = blocks.flatMap((b) => (b.type === 'controls' ? b.items : []));
			const labels = controls.map((x) => x.control).join(' | ');
			for (const label of [c.spin, c.stop, 'SPACE', c.autoplay, c.turbo, c.menu, c.payTableTitle, c.rulesTitle, c.settings, c.sound, c.balance, c.win]) {
				expect(labels, label).toContain(label);
			}
			expect(labels).toContain(`${c.bet} − / +`);
			const text = controls.map((x) => x.text).join(' ');
			expect(text).toContain('START AUTOPLAY');
			expect(text).toMatch(/never starts from a single press/);
		}
	});

	it('includes every point of the general disclaimer verbatim in both modals', () => {
		expect(DISCLAIMER_SENTENCES).toHaveLength(7);
		for (const social of [false, true]) {
			for (const content of allContent(social)) {
				for (const sentence of DISCLAIMER_SENTENCES) {
					expect(joined(content), sentence).toContain(sentence);
				}
			}
		}
	});

	it('never shows the internal name and has no template holes', () => {
		for (const social of [false, true]) {
			for (const content of allContent(social)) {
				expect(joined(content)).not.toMatch(/sticky fruits|undefined|NaN|\{|\}/i);
			}
			expect(joined(rulesContent(social))).toContain('Gilded Salon is a 5-reel, 3-row video slot');
		}
	});
});
