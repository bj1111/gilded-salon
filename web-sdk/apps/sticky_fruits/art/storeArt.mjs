// @ts-nocheck -- Node build script, not part of the browser bundle
// Stake Studio store art: the 3:4 game tile and the 16:9 cover.
//   node art/render3d.mjs   (3D key item, see its header), then
//   node art/storeArt.mjs   (from apps/sticky_fruits) -> ../../../design/store-art/*.jpg
//
// Stake's guidance: an environmental background that shows the world of the game; one key item
// layered over it and enlarged to fill the focus area; bright, vibrant colours (no black or dark
// blue, which vanish on Stake's dark site); no wording or multipliers on the images; the widest
// title font that fits. So: the casino floor from the game, lit up warm; the gilded reels in 3D
// (render3d.mjs), so the art reads as a slot; GILDED SALON in Limelight.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

import { doc, glint } from './lib/defs.mjs';
import { casinoFloor } from './lib/floor.mjs';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.resolve(APP_DIR, '..', '..', '..', 'design', 'store-art');
const FONT_DIR = path.join(APP_DIR, 'static', 'assets', 'fonts');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---------------------------------------------------------------- layers

// The game's casino floor, lit up: no vignette, a warm gold wash and crimson at the edges
const brightFloor = (opts) => {
	const floor = casinoFloor(opts);
	const { W, H } = opts;
	const body = floor.body
		.replace(`<rect width="${W}" height="${H}" fill="url(#vign)"/>`, '')
		.replace(`<rect width="${W}" height="${H}" filter="url(#photoGrain)"/>`, '');
	return `
	${body}
	<defs>
		<radialGradient id="warmWash" cx="0.5" cy="0.42" r="0.75">
			<stop offset="0" stop-color="#FFE6A8" stop-opacity=".95"/>
			<stop offset=".45" stop-color="#F2A93B" stop-opacity=".75"/>
			<stop offset="1" stop-color="#D2283F" stop-opacity=".85"/>
		</radialGradient>
		<radialGradient id="edgeRouge" cx="0.5" cy="0.45" r="0.8">
			<stop offset=".55" stop-color="#E0344A" stop-opacity="0"/>
			<stop offset="1" stop-color="#B3122E" stop-opacity=".55"/>
		</radialGradient>
	</defs>
	<rect width="${W}" height="${H}" fill="url(#warmWash)" style="mix-blend-mode:screen"/>
	<rect width="${W}" height="${H}" fill="url(#edgeRouge)"/>`;
};

// light rays fanning out from behind the key item
const rays = (cx, cy, r, n = 28) =>
	Array.from({ length: n }, (_, i) => {
		const a0 = (i / n) * Math.PI * 2;
		const a1 = a0 + Math.PI / n;
		const p = (a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
		return `<path d="M ${cx} ${cy} L ${p(a0)} L ${p(a1)} Z" fill="#FFF6D8" opacity="${i % 2 ? 0.1 : 0.18}"/>`;
	}).join('');

// the 3D gilded reels rendered by render3d.mjs, scaled so its visible part fits a maxW x maxH box
// centred on (cx, cy)
const KEY_PNG = path.join(OUT_DIR, 'layers', 'key_item_reels.png');
const keyItem3d = (cx, cy, maxW, maxH) => {
	const { size, bbox } = JSON.parse(fs.readFileSync(KEY_PNG.replace(/\.png$/, '.json'), 'utf8'));
	const s = Math.min(maxW / (bbox.x1 - bbox.x0), maxH / (bbox.y1 - bbox.y0));
	const x = cx - ((bbox.x0 + bbox.x1) / 2) * s;
	const y = cy - ((bbox.y0 + bbox.y1) / 2) * s;
	const href = `data:image/png;base64,${fs.readFileSync(KEY_PNG).toString('base64')}`;
	const w = (bbox.x1 - bbox.x0) * s;
	return `
	<ellipse cx="${cx}" cy="${cy}" rx="${w * 0.85}" ry="${w * 0.8}" fill="url(#glowGold)" opacity=".85"/>
	<image href="${href}" x="${x}" y="${y}" width="${size * s}" height="${size * s}"/>`;
};

// GILDED SALON in Limelight: gold face, crimson outline, warm shadow (lines centred on cx)
const title = (lines, cx, top, size, gap = 0.08) => {
	const lineH = size * (1 + gap);
	const text = (line, i, layer) =>
		`<text x="${cx}" y="${top + size * 0.82 + i * lineH}" text-anchor="middle" font-family="Limelight" font-size="${size}" letter-spacing="${size * 0.06}" ${layer}>${line}</text>`;
	return `
	<defs>
		<linearGradient id="titleGold" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#FFF8DC"/><stop offset=".45" stop-color="#FFD66B"/><stop offset=".55" stop-color="#E8A930"/><stop offset="1" stop-color="#FFE9A0"/>
		</linearGradient>
		<filter id="titleShadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="${size * 0.06}" stdDeviation="${size * 0.05}" flood-color="#5A0614" flood-opacity=".75"/></filter>
	</defs>
	<g filter="url(#titleShadow)">
		${lines.map((l, i) => text(l, i, `fill="none" stroke="#7A1020" stroke-width="${size * 0.16}" stroke-linejoin="round"`)).join('')}
		${lines.map((l, i) => text(l, i, `fill="none" stroke="#FFE9A0" stroke-width="${size * 0.05}" stroke-linejoin="round"`)).join('')}
		${lines.map((l, i) => text(l, i, `fill="url(#titleGold)"`)).join('')}
	</g>`;
};

const sparkles = (points) => points.map(([x, y, s]) => glint(x, y, s, 0.95)).join('');

// ---------------------------------------------------------------- compositions

// 3:4 tile, drawn at 900 x 1200 units (rendered at 2x)
const tile = () => {
	const W = 900, H = 1200;
	const cx = W / 2, wy = 470;
	const body = `
	${brightFloor({ W, H, vpY: 760, seed: 23, scale: 0.75, ceil: -900 })}
	<g style="mix-blend-mode:screen">${rays(cx, wy, 1100)}</g>
	${keyItem3d(cx, wy, 820, 770)}
	${title(['GILDED', 'SALON'], cx, 860, 145)}
	${sparkles([[150, 230, 26], [760, 250, 34], [640, 130, 20], [110, 640, 22]])}`;
	return { w: W, h: H, body };
};

// 16:9 cover, drawn at 1920 x 1080 units (rendered at 1x)
const cover = () => {
	const W = 1920, H = 1080;
	const wx = 1390, wy = 540;
	const body = `
	${brightFloor({ W, H, vpY: 560, seed: 7, scale: 1 })}
	<g style="mix-blend-mode:screen">${rays(wx, wy, 1700, 32)}</g>
	${keyItem3d(wx, wy, 900, 960)}
	${title(['GILDED', 'SALON'], 500, 320, 190)}
	${sparkles([[1000, 200, 34], [1760, 220, 30], [260, 820, 24], [1840, 760, 22]])}`;
	return { w: W, h: H, body };
};

// Separate layers for Stake Studio's tile designer: backgrounds without the key item or title.
// The key item alone (transparent PNG) is layers/key_item_reels.png from render3d.mjs.
const tileBackground = () => ({
	w: 900,
	h: 1200,
	body: `${brightFloor({ W: 900, H: 1200, vpY: 760, seed: 23, scale: 0.75, ceil: -900 })}<g style="mix-blend-mode:screen">${rays(450, 470, 1100)}</g>`,
});
const coverBackground = () => ({
	w: 1920,
	h: 1080,
	body: `${brightFloor({ W: 1920, H: 1080, vpY: 560, seed: 7, scale: 1 })}<g style="mix-blend-mode:screen">${rays(1390, 540, 1700, 32)}</g>`,
});
// ---------------------------------------------------------------- render

const fontUrl = (file) => `data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, file)).toString('base64')}`;
const fontFaces = `@font-face { font-family: 'Limelight'; src: url('${fontUrl('Limelight-latin.woff2')}') format('woff2'); }`;

const jobs = [
	{ file: 'tile_3x4.jpg', art: tile(), scale: 2 },
	{ file: 'cover_16x9.jpg', art: cover(), scale: 1 },
	{ file: 'layers/background_3x4.jpg', art: tileBackground(), scale: 2 },
	{ file: 'layers/background_16x9.jpg', art: coverBackground(), scale: 1 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
for (const { file, art, scale } of jobs) {
	const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: art.w, height: art.h } });
	await page.setContent(`<html><head><style>${fontFaces} html,body{margin:0;background:transparent}</style></head><body>${doc(art.w, art.h, art.body)}</body></html>`);
	await page.evaluate(() => document.fonts.load("150px 'Limelight'").then(() => document.fonts.ready));
	const png = file.endsWith('.png');
	fs.mkdirSync(path.dirname(path.join(OUT_DIR, file)), { recursive: true });
	await page.screenshot({
		path: path.join(OUT_DIR, file),
		...(png ? { type: 'png', omitBackground: true } : { type: 'jpeg', quality: 90 }),
		clip: { x: 0, y: 0, width: art.w, height: art.h },
	});
	await page.close();
	console.log(`wrote ${path.relative(process.cwd(), path.join(OUT_DIR, file))} (${art.w * scale} x ${art.h * scale})`);
}
await browser.close();
