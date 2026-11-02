// Bought features: the BUY BONUS plaque, its Bonus Hunt state, buy-menu card icons and the
// Bonus Hunt ribbon. Text is set in the game (Pixi), so the plaque and ribbon carry none.
import { stepRect } from './defs.mjs';
import { symbolBody } from './symbols.mjs';

const KEY = 'M 0 0 a 13 13 0 1 1 -0.1 0 Z M 6 22 L 6 52 L 14 52 M 6 40 L 13 40';

// 260 x 130 plaque: a gold call-to-action with a lacquer key on the left
const buyPlaque = (fill, rim, keyColor) => ({
	w: 260,
	h: 130,
	body: `
	<path d="${stepRect(6, 10, 248, 114, 18)}" fill="#000" opacity=".55" filter="url(#blur8)"/>
	<path d="${stepRect(4, 4, 252, 116, 18)}" fill="${fill}" stroke="${rim}" stroke-width="4"/>
	<path d="${stepRect(13, 13, 234, 98, 12)}" fill="none" stroke="#0B0C0E" stroke-opacity=".55" stroke-width="2"/>
	<path d="M 26 22 H 234" stroke="#FFF8E0" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
	<g transform="translate(46 34)" fill="none" stroke="${keyColor}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="${KEY}"/></g>`,
});

export const buyAssets = {
	btn_buy: buyPlaque('url(#goldD)', '#FFF4CF', '#0B0C0E'),
	btn_buy_hunt: buyPlaque('url(#rougeR)', 'url(#goldD)', '#F5ECD9'),

	// two wild chips stacked: the High-Roller Room
	icon_highroller: {
		w: 256,
		h: 256,
		body: `
		<g transform="translate(-26 14) scale(.82)">${symbolBody('W')}</g>
		<g transform="translate(72 -6) scale(.82)">${symbolBody('W')}</g>`,
	},

	// the golden key under a jeweller's loupe: Bonus Hunt
	icon_hunt: {
		w: 256,
		h: 256,
		body: `
		<g transform="translate(10 10) scale(.78)">${symbolBody('S')}</g>
		<g filter="url(#ds)">
			<path d="M 186 186 L 238 238" stroke="url(#goldD)" stroke-width="22" stroke-linecap="round"/>
			<circle cx="150" cy="150" r="58" fill="#F5ECD9" fill-opacity=".14" stroke="url(#gold)" stroke-width="12"/>
			<path d="M 116 128 A 40 40 0 0 1 150 104" stroke="#fff" stroke-opacity=".7" stroke-width="6" fill="none" stroke-linecap="round"/>
		</g>`,
	},

	// small rouge ribbon hung under the crest while Bonus Hunt is on
	ribbon: {
		w: 320,
		h: 72,
		body: `
		<path d="M 6 14 H 314 L 298 38 L 314 62 H 6 L 22 38 Z" fill="#000" opacity=".5" filter="url(#blur3)" transform="translate(0 3)"/>
		<path d="M 6 10 H 314 L 298 34 L 314 58 H 6 L 22 34 Z" fill="url(#rougeR)" stroke="url(#goldD)" stroke-width="3"/>
		<path d="M 30 18 H 290 M 30 50 H 290" stroke="#F0D592" stroke-opacity=".55" stroke-width="1.5"/>`,
	},
};
