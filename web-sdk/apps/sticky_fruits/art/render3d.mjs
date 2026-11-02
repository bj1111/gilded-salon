// @ts-nocheck -- Node build script, not part of the browser bundle
// Renders the store-art key item, the gilded reels (a 3D art-deco reel window showing the game's own
// symbols), with three.js in headless Chrome.
// Output: design/store-art/layers/key_item_reels.png (transparent) + .json (visible bounding box).
//
//   THREE_DIR=/path/to/node_modules/three node art/render3d.mjs     (from apps/sticky_fruits)
//
// three.js is not a dependency of the game; install it anywhere outside the pnpm workspace, e.g.
//   mkdir /tmp/three3d && cd /tmp/three3d && echo '{}' > package.json && npm i three@0.180.0
//
// Stake's tile rules forbid wording on the images, so the WILD chip and the BONUS key are drawn
// without their text (a ruby replaces WILD; the BONUS plate is left off).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

import { doc } from './lib/defs.mjs';
import { symbolBody } from './lib/symbols.mjs';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(APP_DIR, '..', '..', '..', 'design', 'store-art', 'layers', 'key_item_reels.png');
const THREE_DIR = process.env.THREE_DIR;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SIZE = 2400;
if (!THREE_DIR || !fs.existsSync(path.join(THREE_DIR, 'build', 'three.module.js'))) {
	throw new Error('set THREE_DIR to an installed three package (see the header of this file)');
}

// ---------------------------------------------------------------- text-free symbol art
const RUBY = `<path d="M128 84 L 166 128 L 128 172 L 90 128 Z" fill="url(#rougeR)" stroke="url(#gold)" stroke-width="5" stroke-linejoin="round"/>
	<path d="M128 84 L 166 128 L 128 128 Z" fill="#fff" opacity=".22"/>`;
const SYMBOLS = {
	chip: symbolBody('W').replace(/<text[^>]*>WILD<\/text>/, RUBY),
	key: symbolBody('S').replace(/<path d="M64 196[^>]*\/>/, '').replace(/<text[^>]*>BONUS<\/text>/, ''),
	diamond: symbolBody('H2'),
	dice: symbolBody('H3'),
};
for (const [k, body] of Object.entries(SYMBOLS)) {
	if (/<text|M64 196/.test(body)) throw new Error(`symbol ${k} still has text or its plate`);
}
const symbolUrls = Object.fromEntries(
	Object.entries(SYMBOLS).map(([k, body]) => [k, `data:image/svg+xml;base64,${Buffer.from(doc(256, 256, body)).toString('base64')}`]),
);

// what each reel shows: [middle, above, ..., below] around the drum (10 stops)
const REELS = [
	['chip', 'dice', 'key', 'diamond', 'chip', 'dice', 'key', 'chip', 'dice', 'diamond'],
	['chip', 'key', 'diamond', 'dice', 'chip', 'key', 'diamond', 'chip', 'key', 'dice'],
	['chip', 'diamond', 'dice', 'key', 'chip', 'diamond', 'dice', 'chip', 'diamond', 'key'],
];

// ---------------------------------------------------------------- scene (runs in the page)
const sceneModule = `
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SIZE = ${SIZE};
const SYMBOL_URLS = ${JSON.stringify(symbolUrls)};
const REELS = ${JSON.stringify(REELS)};

const loadImage = (src) => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = src; });
const images = Object.fromEntries(await Promise.all(Object.entries(SYMBOL_URLS).map(async ([k, u]) => [k, await loadImage(u)])));

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const gold = phys({ color: 0xf5c560, metalness: 1, roughness: 0.22 });
const goldSoft = phys({ color: 0xdcaa4c, metalness: 1, roughness: 0.34 });
const lacquer = phys({ color: 0xb0102a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 });
const ruby = phys({ color: 0xd0123a, roughness: 0.05, clearcoat: 1, metalness: 0.1 });
const add = (parent, geometry, material, setup) => {
	const mesh = new THREE.Mesh(geometry, material);
	setup?.(mesh);
	parent.add(mesh);
	return mesh;
};

const machine = new THREE.Group();
scene.add(machine);

// ------------------------------------------------ reel drums
const N = 10, CELL = 256, R = 1.6, REEL_W = 1.02, GAP = 0.08;
const reelTexture = (sequence) => {
	const c = document.createElement('canvas');
	c.width = N * CELL;
	c.height = CELL;
	const g = c.getContext('2d');
	// cream face, darker toward the reel edges
	const bg = g.createLinearGradient(0, 0, 0, CELL);
	bg.addColorStop(0, '#ead3a2'); bg.addColorStop(0.18, '#fff7e6'); bg.addColorStop(0.82, '#fff7e6'); bg.addColorStop(1, '#ead3a2');
	g.fillStyle = bg;
	g.fillRect(0, 0, c.width, CELL);
	// faint gold rules between stops
	g.fillStyle = 'rgba(201,154,69,.35)';
	for (let k = 0; k < N; k++) g.fillRect(k * CELL + CELL / 2 - 2, 0, 4, CELL);
	// symbols: stop k is centred at u = k / N; drawn turned a quarter so they stand upright on the drum
	const draw = (img, cx) => {
		g.save();
		g.translate(cx, CELL / 2);
		g.rotate(Math.PI / 2);
		g.drawImage(img, -CELL * 0.43, -CELL * 0.43, CELL * 0.86, CELL * 0.86);
		g.restore();
	};
	sequence.forEach((name, k) => draw(images[name], k * CELL));
	draw(images[sequence[0]], N * CELL);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 16;
	return t;
};
REELS.forEach((sequence, i) => {
	const x = (i - 1) * (REEL_W + GAP);
	add(machine, new THREE.CylinderGeometry(R, R, REEL_W, 160, 1, true), phys({ map: reelTexture(sequence), roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2 }), (m) => {
		m.rotation.z = Math.PI / 2;
		m.position.set(x, 0, -R);
	});
	// gold end rings on each drum
	for (const side of [-1, 1]) {
		add(machine, new THREE.TorusGeometry(R, 0.022, 12, 160), goldSoft, (m) => {
			m.rotation.y = Math.PI / 2;
			m.position.set(x + (side * REEL_W) / 2, 0, -R);
		});
	}
});

// ------------------------------------------------ frame
const OUT_W = 4.3, OUT_H = 4.05, IN_W = 3.34, IN_H = 3.02, STEP = 0.32;
const stepped = (w, h, s) => {
	const shape = new THREE.Shape();
	const x = w / 2, y = h / 2;
	shape.moveTo(-x + s, -y);
	shape.lineTo(x - s, -y); shape.lineTo(x - s, -y + s); shape.lineTo(x, -y + s);
	shape.lineTo(x, y - s); shape.lineTo(x - s, y - s); shape.lineTo(x - s, y);
	shape.lineTo(-x + s, y); shape.lineTo(-x + s, y - s); shape.lineTo(-x, y - s);
	shape.lineTo(-x, -y + s); shape.lineTo(-x + s, -y + s); shape.lineTo(-x + s, -y);
	return shape;
};
const rect = (w, h) => {
	const p = new THREE.Path();
	p.moveTo(-w / 2, -h / 2); p.lineTo(w / 2, -h / 2); p.lineTo(w / 2, h / 2); p.lineTo(-w / 2, h / 2); p.lineTo(-w / 2, -h / 2);
	return p;
};
const frameShape = stepped(OUT_W, OUT_H, STEP);
frameShape.holes.push(rect(IN_W, IN_H));
add(machine, new THREE.ExtrudeGeometry(frameShape, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 4, curveSegments: 8 }), gold, (m) => { m.position.z = 0.02; });
// rouge inner trim
const trimShape = stepped(IN_W + 0.28, IN_H + 0.28, 0.08);
trimShape.holes.push(rect(IN_W, IN_H));
add(machine, new THREE.ExtrudeGeometry(trimShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), lacquer, (m) => { m.position.z = 0.36; });
// engraved line on the gold face
const lineShape = stepped(OUT_W - 0.34, OUT_H - 0.34, STEP - 0.12);
lineShape.holes.push(stepped(OUT_W - 0.4, OUT_H - 0.4, STEP - 0.14));
add(machine, new THREE.ExtrudeGeometry(lineShape, { depth: 0.02, bevelEnabled: false }), goldSoft, (m) => { m.position.z = 0.43; });
// cabinet body behind the frame, closing in the drums
const shell = stepped(OUT_W - 0.16, OUT_H - 0.16, STEP);
shell.holes.push(rect(IN_W + 0.02, IN_H + 0.02));
add(machine, new THREE.ExtrudeGeometry(shell, { depth: 3.4, bevelEnabled: false }), lacquer, (m) => { m.position.z = -3.38; });
add(machine, new THREE.BoxGeometry(OUT_W - 0.2, OUT_H - 0.2, 0.04), phys({ color: 0x2a0710, roughness: 0.6 }), (m) => { m.position.z = -3.36; });
// gold dividers between reels
for (const s of [-1, 1]) {
	add(machine, new THREE.BoxGeometry(0.07, IN_H, 0.1), gold, (m) => { m.position.set((s * (REEL_W + GAP)) / 2, 0, 0.05); });
}
// deco fan crest on top, with a ruby
const crest = new THREE.Group();
crest.position.set(0, OUT_H / 2 + 0.04, 0.18);
machine.add(crest);
add(crest, new THREE.CylinderGeometry(1.15, 1.15, 0.22, 96, 1, false, -Math.PI / 2, Math.PI), lacquer, (m) => { m.rotation.x = -Math.PI / 2; });
add(crest, new THREE.CylinderGeometry(0.95, 0.95, 0.24, 96, 1, false, -Math.PI / 2, Math.PI), goldSoft, (m) => { m.rotation.x = -Math.PI / 2; m.position.z = 0.03; });
for (let i = 1; i < 12; i++) {
	const a = (i / 12) * Math.PI;
	add(crest, new THREE.BoxGeometry(0.035, 0.85, 0.05), gold, (m) => {
		m.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.16);
		m.rotation.z = a - Math.PI / 2;
	});
}
add(crest, new THREE.TorusGeometry(1.15, 0.05, 16, 96, Math.PI), gold, (m) => { m.position.z = 0.12; });
add(crest, new THREE.SphereGeometry(0.2, 48, 24), ruby, (m) => { m.position.set(0, 0.12, 0.22); m.scale.set(1, 1.15, 0.6); });

// ------------------------------------------------ marquee bulbs around the frame
const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd27a, emissiveIntensity: 2.2 });
const haloTex = (() => {
	const c = document.createElement('canvas'); c.width = c.height = 128;
	const g = c.getContext('2d');
	const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	grad.addColorStop(0, 'rgba(255,240,200,.95)'); grad.addColorStop(0.35, 'rgba(255,200,110,.45)'); grad.addColorStop(1, 'rgba(255,180,80,0)');
	g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
	return new THREE.CanvasTexture(c);
})();
const bulb = (x, y) => {
	add(machine, new THREE.SphereGeometry(0.055, 20, 12), bulbMat, (m) => { m.position.set(x, y, 0.47); });
	const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
	halo.scale.set(0.34, 0.34, 1);
	halo.position.set(x, y, 0.5);
	machine.add(halo);
};
const bx = OUT_W / 2 - 0.2, by = OUT_H / 2 - 0.2;
for (let i = 0; i <= 12; i++) { const x = -bx + 0.3 + (i * (2 * bx - 0.6)) / 12; bulb(x, by); bulb(x, -by); }
for (let i = 1; i < 12; i++) { const y = -by + 0.3 + (i * (2 * by - 0.6)) / 12; bulb(bx, y); bulb(-bx, y); }

// ------------------------------------------------ light and camera
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a2a1a, 0.7));
const key = new THREE.DirectionalLight(0xfff0d6, 2.4);
key.position.set(-3, 4, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffc27a, 1.6);
rim.position.set(5, 2, -2);
scene.add(rim);

machine.rotation.set(0.07, -0.3, 0);
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0.2, 0.6, 13.2);
camera.lookAt(0, 0.45, 0);

renderer.render(scene, camera);

// bounding box of the visible pixels, so the store-art layout can place the item exactly
const probe = document.createElement('canvas');
probe.width = probe.height = SIZE;
const pg = probe.getContext('2d');
pg.drawImage(renderer.domElement, 0, 0);
const alpha = pg.getImageData(0, 0, SIZE, SIZE).data;
let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
for (let y = 0; y < SIZE; y += 2) for (let x = 0; x < SIZE; x += 2) {
	if (alpha[(y * SIZE + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
}
window.__bbox = { x0, y0, x1, y1 };
window.__png = renderer.domElement.toDataURL('image/png');
`;

// ---------------------------------------------------------------- render
const html = `<!doctype html><html><head>
<script type="importmap">{"imports":{"three":"http://render.local/three/build/three.module.js","three/addons/":"http://render.local/three/examples/jsm/"}}</script>
<style>html,body{margin:0;background:transparent}</style></head>
<body><script type="module">${sceneModule}</script></body></html>`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.route('http://render.local/**', (route) => {
	const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/three\//, ''));
	const file = path.join(THREE_DIR, rel);
	if (!file.startsWith(path.resolve(THREE_DIR)) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
	return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file) });
});
await page.route('http://render.local/index.html', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
await page.goto('http://render.local/index.html');
await page.waitForFunction(() => window.__png || null, null, { timeout: 240_000 }).catch(() => {});
const dataUrl = await page.evaluate(() => window.__png ?? null);
const bbox = await page.evaluate(() => window.__bbox ?? null);
await browser.close();
if (!dataUrl) throw new Error(`render failed: ${errors.join(' | ') || 'no output'}`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
fs.writeFileSync(OUT.replace(/\.png$/, '.json'), JSON.stringify({ size: SIZE, bbox }, null, 1));
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${SIZE} x ${SIZE})${errors.length ? ` warnings: ${errors.join(' | ')}` : ''}`);
