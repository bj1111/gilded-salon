// @ts-nocheck -- Node build script, not part of the browser bundle
// Draws every Gilded Salon art asset as SVG and renders it with Chrome (playwright-core).
// Output: static/assets/sprites/gs/* and src/game/artAssets.ts (asset manifest + geometry).
//
//   node art/generate.mjs                 (from apps/sticky_fruits)
//   node art/generate.mjs sym_W frame     (only the named assets; manifest still lists everything)
//   CHROME=/path/to/chrome node art/generate.mjs
//
// These are code-drawn originals. To upgrade any asset, drop a same-named file into
// static/assets/sprites/gs/ (see design/ART_BRIEF.md) — no code changes needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

import { doc } from './lib/defs.mjs';
import { SYMBOL_IDS, symbolBody, blurredSymbolBody } from './lib/symbols.mjs';
import * as scene from './lib/scene.mjs';
import { casinoLandscape, casinoPortrait } from './lib/floor.mjs';
import * as ui from './lib/ui.mjs';
import { fx } from './lib/fx.mjs';
import { buyAssets } from './lib/buy.mjs';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(APP_DIR, 'static', 'assets', 'sprites', 'gs');
const FONT_DIR = path.join(APP_DIR, 'static', 'assets', 'fonts');
const MANIFEST = path.join(APP_DIR, 'src', 'game', 'artAssets.ts');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---------------------------------------------------------------- asset list
// scale = output pixels per art unit; jpg for opaque full-screen art (much smaller than png)

const assets = {};
const add = (key, { w, h, body }, { scale = 2, format = 'png' } = {}) => (assets[key] = { w, h, body, scale, format });

for (const id of SYMBOL_IDS) {
	add(`sym_${id}`, { w: 256, h: 256, body: symbolBody(id) }, { scale: 1.6 });
	add(`sym_${id}_blur`, { w: 256, h: 256, body: blurredSymbolBody(id) }, { scale: 1 });
}

const salonL = casinoLandscape();
const salonP = casinoPortrait();
add('bg_salon', salonL, { scale: 1.25, format: 'jpg' });
add('bg_salon_p', salonP, { scale: 1.25, format: 'jpg' });
add('bg_private', scene.privateRoom(salonL), { scale: 1.25, format: 'jpg' });
add('bg_private_p', scene.privateRoom(salonP), { scale: 1.25, format: 'jpg' });
add('curtain', scene.curtain(), { scale: 1 });
add('valance', scene.valance(), { scale: 1 });

const frame = scene.frame();
add('frame', frame, { scale: 3 });
add('felt', scene.felt(), { scale: 2.5, format: 'jpg' });
add('reel_shade', scene.reelShade(), { scale: 1 });
add('logo', scene.logo(), { scale: 2.5 });
add('logo_blank', scene.logo({ title: false }), { scale: 2.5 });
add('panel', scene.panel(), { scale: 2 });
add('plaque', scene.plaque(), { scale: 2.5 });
add('rail', scene.rail(), { scale: 2 });
add('rake', scene.rake(), { scale: 2 });
for (const [key, text] of Object.entries({
	banner_big: 'BIG WIN',
	banner_grand: 'GRAND WIN',
	banner_mega: 'MEGA WIN',
	banner_legendary: 'LEGENDARY',
	banner_max: 'MAX WIN',
})) {
	add(key, scene.banner(text), { scale: 1.5 });
}

add('btn_round', ui.buttonRound(), { scale: 2.5 });
add('spin_ring', ui.spinRing(), { scale: 2.5 });
add('spin_core', ui.spinCore(), { scale: 2.5 });
for (const [key, icon] of Object.entries(ui.icons)) add(key, icon, { scale: 3 });

add('card', scene.panel(360, 460), { scale: 2 });
add('card_wide', scene.panel(640, 250), { scale: 2 });
for (const [key, asset] of Object.entries(buyAssets)) add(key, asset, { scale: 2 });

const FX_SCALE = { fx_ray: 0.5, fx_spot: 0.5, fx_glow: 1, fx_rouge: 1, fx_ring: 1.5, fx_sweep: 1, fx_divider: 2, fx_beam: 1 };
for (const [key, asset] of Object.entries(fx)) add(key, asset, { scale: FX_SCALE[key] ?? 2 });

// ---------------------------------------------------------------- render

// fonts are embedded as data URLs: a setContent page cannot fetch file:// resources
const fontUrl = (file) => `data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, file)).toString('base64')}`;
const fontFaces = `
@font-face { font-family: 'Limelight'; src: url('${fontUrl('Limelight-latin.woff2')}') format('woff2'); }
@font-face { font-family: 'Josefin Sans'; font-weight: 100 900; src: url('${fontUrl('JosefinSans-latin.woff2')}') format('woff2'); }`;

const only = process.argv.slice(2);
const keys = Object.keys(assets).filter((key) => only.length === 0 || only.includes(key));

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
for (const key of keys) {
	const { w, h, body, scale, format } = assets[key];
	// a fresh page per asset: resizing one page between very different sizes makes Chrome tile the capture
	const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: Math.ceil(w), height: Math.ceil(h) } });
	await page.setContent(`<html><head><style>${fontFaces} html,body{margin:0;background:transparent}</style></head><body>${doc(w, h, body)}</body></html>`);
	await page.evaluate(() =>
		Promise.all([document.fonts.load("40px 'Limelight'"), document.fonts.load("700 40px 'Josefin Sans'")]).then(() => document.fonts.ready),
	);
	const file = path.join(OUT_DIR, `${key}.${format}`);
	await page.screenshot({
		path: file,
		type: format === 'jpg' ? 'jpeg' : 'png',
		...(format === 'jpg' ? { quality: 84 } : { omitBackground: true }),
		clip: { x: 0, y: 0, width: w, height: h },
	});
	await page.close();
}
await browser.close();

// ---------------------------------------------------------------- manifest

const geometry = {
	board: scene.BOARD,
	frame: frame.geometry,
	logo: scene.LOGO_GEOMETRY,
	bg: {
		landscape: { w: salonL.w, h: salonL.h, lights: salonL.lights, glints: salonL.glints },
		portrait: { w: salonP.w, h: salonP.h, lights: salonP.lights, glints: salonP.glints },
	},
	sizes: Object.fromEntries(Object.entries(assets).map(([key, { w, h }]) => [key, { w, h }])),
};

const entries = Object.entries(assets)
	.map(
		([key, { format }]) =>
			`\t${key}: {\n\t\ttype: 'sprite',\n\t\tsrc: new URL('../../assets/sprites/gs/${key}.${format}', import.meta.url).href,\n\t\tpreload: false,\n\t},`,
	)
	.join('\n');

fs.writeFileSync(
	MANIFEST,
	`// Generated by art/generate.mjs. Do not edit.\n\n` +
		`// Sizes are in art units (the size the asset was drawn at); positions are in those units too.\n` +
		`export const ART_GEOMETRY = ${JSON.stringify(geometry)} as const;\n\n` +
		`// Everything streams in behind the loader (preload: false) so its progress bar is real.\n` +
		`export default {\n${entries}\n} as const;\n`,
);
console.log(`rendered ${keys.length}/${Object.keys(assets).length} assets to ${path.relative(APP_DIR, OUT_DIR)}`);
