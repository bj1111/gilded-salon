#!/usr/bin/env node
/**
 * Gilded Salon audio check.
 *
 * Bundles src/audio for the browser (esbuild, in memory), opens headless Chrome (playwright-core)
 * and renders every synth voice, loop and music track with OfflineAudioContext (48 kHz stereo)
 * through the real bus graph (sfx/music bus → room → master → limiter). For each render it asserts:
 * no NaN, peak 0.05..0.98 (also before the limiter), duration within expectations; plus pitch
 * ladders (keyLand), reel panning (reelStop), tier escalation and loudness balance. It then drives
 * the live engine on a real AudioContext (volume 0 must silence everything).
 *
 * Every render is written as 16-bit WAV to <repo>/design/audio-preview/<name>.wav.
 *
 *   node tools/audio-check.mjs            # from apps/sticky_fruits
 *   node tools/audio-check.mjs --no-wav   # analysis only
 */
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(APP, '../../../design/audio-preview');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WRITE_WAV = !process.argv.includes('--no-wav');

const require = createRequire(path.join(APP, 'package.json'));
function load(name) {
	try {
		return require(name);
	} catch {
		// esbuild is not a direct dependency of the app; vite brings it along.
		return createRequire(require.resolve('vite'))(name);
	}
}
const esbuild = load('esbuild');
const { chromium } = load('playwright-core');

// Expected sounding length (seconds, as reported by the voice) per sound.
const EXPECT = {
	uiClick: [0.02, 0.15],
	spinPress: [0.1, 0.4],
	reelStart: [0.2, 0.45],
	reelStop: [0.05, 0.25],
	wildLand: [0.8, 2.2],
	keyLand: [0.8, 2.0],
	anticipation: [2.0, 2.4],
	lineTrace: [0.8, 1.6],
	winSmall: [1.0, 1.8],
	winNice: [1.2, 2.0],
	winGreat: [1.5, 2.6],
	countTick: [0.02, 0.1],
	countEnd: [1.5, 2.6],
	tierBig: [2.0, 2.6],
	tierGrand: [2.3, 3.0],
	tierMega: [2.8, 3.6],
	tierLegendary: [3.2, 3.9],
	tierMax: [3.6, 4.4],
	chipShower: [1.6, 2.3],
	freeSpinsIntro: [2.2, 3.0],
	chipLock: [0.3, 0.8],
	retrigger: [1.0, 2.0],
	bonusEnd: [1.8, 2.8],
	doorsOpen: [1.1, 1.3],
	curtains: [0.85, 1.0],
};

// ---- bundle -------------------------------------------------------------------------------------------

const bundle = await esbuild.build({
	stdin: {
		contents: `
			export * from './src/audio/voices.ts';
			export * from './src/audio/music.ts';
			export * from './src/audio/soundMap.ts';
			export { buildGraph, AudioEngine } from './src/audio/engine.ts';
		`,
		resolveDir: APP,
		loader: 'ts',
	},
	bundle: true,
	format: 'iife',
	globalName: 'GS',
	target: 'es2020',
	write: false,
	logLevel: 'warning',
	logOverride: { 'empty-import-meta': 'silent' },
});
const code = bundle.outputFiles[0].text;

// ---- in-page helpers (serialized into the page) ------------------------------------------------------

const PAGE_HELPERS = String.raw`
window.check = (() => {
	const SR = 48000;
	// Voices start after the limiter has settled: a freshly created DynamicsCompressor begins in a
	// gain-reduced state and releases over the first few hundred ms (the live engine's never is).
	const START = 0.5;

	function analyze(buf, dur) {
		const L = buf.getChannelData(0), R = buf.getChannelData(1);
		const n = buf.length;
		let nan = 0, peak = 0, sum = 0, sumL = 0, sumR = 0, dsum = 0;
		const a0 = Math.floor(START * SR), a1 = Math.min(n, Math.floor((START + dur) * SR));
		for (let i = 0; i < n; i++) {
			const l = L[i], r = R[i];
			if (!Number.isFinite(l) || !Number.isFinite(r)) { nan++; continue; }
			const m = Math.max(Math.abs(l), Math.abs(r));
			if (m > peak) peak = m;
			sumL += l * l; sumR += r * r;
			if (i >= a0 && i < a1) {
				sum += (l * l + r * r) / 2;
				if (i > a0) { const dl = l - L[i - 1]; dsum += dl * dl; }
			}
		}
		const span = Math.max(1, a1 - a0);
		const rms = Math.sqrt(sum / span);
		// loudest 100 ms window (short-term loudness proxy)
		const W = Math.floor(0.1 * SR);
		let maxWin = 0;
		for (let s = 0; s + W <= n; s += Math.floor(W / 2)) {
			let acc = 0;
			for (let i = s; i < s + W; i++) acc += (L[i] * L[i] + R[i] * R[i]) / 2;
			maxWin = Math.max(maxWin, Math.sqrt(acc / W));
		}
		let last = 0;
		const thr = Math.max(1e-4, peak * 0.001);
		for (let i = n - 1; i >= 0; i--) if (Math.abs(L[i]) > thr || Math.abs(R[i]) > thr) { last = i; break; }
		const centroid = rms > 0 ? (Math.sqrt(dsum / span) / Math.max(1e-9, Math.sqrt(sum / span))) * SR / (2 * Math.PI) : 0;
		return { nan, peak, rms, maxWin, audible: last / SR - START, centroid, balance: sumR / Math.max(1e-12, sumL + sumR) };
	}

	function goertzel(buf, f, t0, t1) {
		const x = buf.getChannelData(0), y = buf.getChannelData(1);
		const k = 2 * Math.cos(2 * Math.PI * f / SR);
		let s1 = 0, s2 = 0;
		for (let i = Math.floor(t0 * SR); i < Math.floor(t1 * SR); i++) {
			const s = (x[i] + y[i]) / 2 + k * s1 - s2; s2 = s1; s1 = s;
		}
		return s1 * s1 + s2 * s2 - k * s1 * s2;
	}

	function pcm16(buf, seconds) {
		// Preview starts 20 ms before the sound (skips the limiter settle-in silence).
		const from = Math.max(0, Math.floor((START - 0.02) * SR));
		const frames = Math.max(1, Math.min(buf.length, Math.ceil(seconds * SR)) - from);
		const L = buf.getChannelData(0), R = buf.getChannelData(1);
		const out = new Int16Array(frames * 2);
		for (let i = 0; i < frames; i++) {
			const fade = Math.min(1, (frames - i) / 480); // 10 ms tail fade for clean previews
			out[2 * i] = Math.max(-1, Math.min(1, L[from + i] * fade)) * 32767;
			out[2 * i + 1] = Math.max(-1, Math.min(1, R[from + i] * fade)) * 32767;
		}
		const bytes = new Uint8Array(out.buffer);
		let bin = '';
		for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
		return btoa(bin);
	}

	async function render(seconds, limiter, schedule) {
		const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
		const g = GS.buildGraph(ctx, ctx.destination, { limiter });
		GS.reseed(0x5eed);
		const dur = schedule(ctx, g);
		const buf = await ctx.startRendering();
		return { buf, dur };
	}

	/** Render twice (raw, then through the limiter); report the limited render + raw peak. */
	async function measure(seconds, schedule, wav) {
		const raw = await render(seconds, false, schedule);
		const rawStats = analyze(raw.buf, raw.dur);
		const fin = await render(seconds, true, schedule);
		const stats = analyze(fin.buf, fin.dur);
		return { dur: fin.dur, rawPeak: rawStats.peak, ...stats, buf: fin.buf, wav: wav ? pcm16(fin.buf, Math.min(seconds, stats.audible + START + 0.15)) : null };
	}

	const strip = ({ buf, ...rest }) => rest;

	return {
		names: () => GS.SFX_NAMES.slice(),

		voice: async (name, opts, wav) =>
			strip(await measure(START + 7, (ctx, g) => GS.voices[name](ctx, g.sfx, START, opts), wav)),

		keyPitches: async () => {
			const freqs = [1, 2, 3, 4, 5].map((i) => GS.mtof(80) * GS.keyPitch(i));
			const rows = [];
			for (let i = 1; i <= 5; i++) {
				const { buf } = await render(START + 2.5, true, (ctx, g) => GS.voices.keyLand(ctx, g.sfx, START, { index: i }));
				const powers = freqs.map((f) => goertzel(buf, f, START + 0.02, START + 0.35));
				rows.push({ index: i, expectHz: freqs[i - 1], argmax: powers.indexOf(Math.max(...powers)) + 1 });
			}
			return rows;
		},

		sequence: async (kind, wav) => {
			const sched = {
				reelStops: (ctx, g) => { for (let r = 0; r < 5; r++) GS.voices.reelStop(ctx, g.sfx, START + r * 0.16, { index: r }); return 1.0; },
				keyLand: (ctx, g) => { for (let k = 1; k <= 5; k++) GS.voices.keyLand(ctx, g.sfx, START + (k - 1) * 0.5, { index: k }); return 3.6; },
			}[kind];
			return strip(await measure(START + 5, sched, wav));
		},

		loop: async (name, seconds, wav) =>
			strip(
				await measure(START + seconds + 2, (ctx, g) => {
					const layer = ctx.createGain();
					layer.connect(g.sfx);
					let t = START, n = 0;
					const end = START + seconds;
					while (t < end) {
						const progress = (t - START) / seconds;
						t += GS.loopSegments[name](ctx, layer, t, { index: progress }, n++);
					}
					layer.gain.setValueAtTime(1, end);
					layer.gain.linearRampToValueAtTime(0, end + 0.12);
					return seconds;
				}, wav),
			),

		music: async (track, bars, wav) =>
			strip(await measure(START + bars * GS.barSeconds(track) + 2, (ctx, g) => GS.renderMusic(ctx, g.music, track, START, bars), wav)),

		/** Drive the live engine on a real AudioContext and listen at the output. */
		engine: async () => {
			let analyser = null;
			const engine = new GS.AudioEngine({
				overrides: {},
				destination: (ctx) => {
					analyser = ctx.createAnalyser();
					analyser.fftSize = 2048;
					analyser.connect(ctx.destination);
					return analyser;
				},
			});
			const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
			const level = async (ms) => {
				const data = new Float32Array(analyser.fftSize);
				let max = 0;
				for (let t = 0; t < ms; t += 40) {
					analyser.getFloatTimeDomainData(data);
					let acc = 0;
					for (const v of data) acc += v * v;
					max = Math.max(max, Math.sqrt(acc / data.length));
					await sleep(40);
				}
				return max;
			};
			const errors = [];
			const out = {};
			try {
				await engine.unlock();
				await engine.unlock();
				out.state = engine['ctx'] && engine['ctx'].state;
				engine.music('base');
				await sleep(1500);
				out.musicRms = await level(1200);
				engine.setVolume(0);
				await sleep(150);
				engine.play('tierMax');
				engine.loop('chipShower');
				out.mutedRms = await level(600);
				engine.stop('chipShower');
				engine.setVolume(1);
				engine.music(null);
				await sleep(1400);
				out.afterMusicOffRms = await level(300);
				engine.play('winGreat');
				out.sfxRms = await level(500);
				for (const name of GS.SFX_NAMES) engine.play(name, { index: 2, volume: 0.6 });
				engine.loop('anticipation'); engine.loop('countTick'); engine.loop('chipShower');
				for (let i = 0; i <= 10; i++) { engine.play('countTick', { index: i / 10 }); await sleep(30); }
				engine.stop('anticipation'); engine.stop('countTick'); engine.stop('chipShower');
				engine.music('private');
				await sleep(800);
				engine.music('base');
				await sleep(300);
				engine.suspend();
				await sleep(100);
				out.suspended = engine['ctx'].state;
				engine.resume();
				await sleep(100);
				out.resumed = engine['ctx'].state;
				engine.music(null);
				engine.dispose();
			} catch (e) {
				errors.push(String(e && e.stack || e));
			}
			return { ...out, errors };
		},
	};
})();
`;

// ---- run ------------------------------------------------------------------------------------------------

const browser = await chromium.launch({
	executablePath: CHROME,
	args: ['--autoplay-policy=no-user-gesture-required'],
});
const failures = [];
const fail = (msg) => failures.push(msg);
const rows = [];
const pageErrors = [];

try {
	const page = await browser.newPage();
	page.on('pageerror', (e) => pageErrors.push(String(e)));
	page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
	await page.setContent('<!doctype html><html><body>audio check</body></html>');
	await page.addScriptTag({ content: code });
	await page.addScriptTag({ content: PAGE_HELPERS });

	if (WRITE_WAV) await fs.mkdir(OUT, { recursive: true });
	const writeWav = async (name, b64) => {
		if (!WRITE_WAV || !b64) return;
		const pcm = Buffer.from(b64, 'base64');
		const h = Buffer.alloc(44);
		h.write('RIFF', 0);
		h.writeUInt32LE(36 + pcm.length, 4);
		h.write('WAVE', 8);
		h.write('fmt ', 12);
		h.writeUInt32LE(16, 16);
		h.writeUInt16LE(1, 20); // PCM
		h.writeUInt16LE(2, 22); // stereo
		h.writeUInt32LE(48000, 24);
		h.writeUInt32LE(48000 * 4, 28);
		h.writeUInt16LE(4, 32);
		h.writeUInt16LE(16, 34);
		h.write('data', 36);
		h.writeUInt32LE(pcm.length, 40);
		await fs.writeFile(path.join(OUT, `${name}.wav`), Buffer.concat([h, pcm]));
	};

	const record = async (label, kind, stats, expect) => {
		const { wav, ...s } = stats;
		await writeWav(label, wav);
		rows.push({ label, kind, ...s });
		if (s.nan) fail(`${label}: ${s.nan} NaN samples`);
		if (!(s.peak >= 0.05 && s.peak <= 0.98)) fail(`${label}: peak ${s.peak.toFixed(3)} outside 0.05..0.98`);
		if (s.rawPeak > 0.98) fail(`${label}: pre-limiter peak ${s.rawPeak.toFixed(3)} > 0.98`);
		// Below the limiter threshold the limited render must match the raw one (makeup gain compensated).
		if (s.rawPeak < 0.5 && Math.abs(20 * Math.log10(s.peak / s.rawPeak)) > 0.3)
			fail(`${label}: limiter not unity below threshold (${s.rawPeak.toFixed(3)} → ${s.peak.toFixed(3)})`);
		if (expect && !(s.dur >= expect[0] && s.dur <= expect[1]))
			fail(`${label}: duration ${s.dur.toFixed(3)}s outside ${expect[0]}..${expect[1]}`);
	};

	const names = await page.evaluate(() => check.names());
	const missing = Object.keys(EXPECT).filter((n) => !names.includes(n));
	if (missing.length || names.length !== Object.keys(EXPECT).length) fail(`name mismatch: ${missing.join(', ')}`);

	for (const name of names) {
		await record(name, 'sfx', await page.evaluate(([n]) => check.voice(n, {}, true), [name]), EXPECT[name]);
	}
	for (let r = 0; r < 5; r++)
		await record(`reelStop_${r}`, 'variant', await page.evaluate(([i]) => check.voice('reelStop', { index: i }, true), [r]), EXPECT.reelStop);
	for (let k = 1; k <= 5; k++)
		await record(`keyLand_${k}`, 'variant', await page.evaluate(([i]) => check.voice('keyLand', { index: i }, true), [k]), EXPECT.keyLand);
	for (const p of [0, 1])
		await record(`countTick_${p}`, 'variant', await page.evaluate(([i]) => check.voice('countTick', { index: i }, true), [p]), EXPECT.countTick);
	await record('seq_reelStops', 'sequence', await page.evaluate(() => check.sequence('reelStops', true)));
	await record('seq_keyLand', 'sequence', await page.evaluate(() => check.sequence('keyLand', true)));
	for (const [name, secs] of [
		['anticipation', 6],
		['countTick', 3],
		['chipShower', 4],
	])
		await record(`loop_${name}`, 'loop', await page.evaluate(([n, s]) => check.loop(n, s, true), [name, secs]));
	for (const track of ['base', 'private'])
		await record(`music_${track}`, 'music', await page.evaluate(([t]) => check.music(t, 16, true), [track]));

	// ---- musical sanity ----
	const keys = await page.evaluate(() => check.keyPitches());
	for (const k of keys) if (k.argmax !== k.index) fail(`keyLand ${k.index}: strongest pitch is ladder step ${k.argmax}`);

	const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
	const bal = [0, 1, 2, 3, 4].map((r) => byLabel[`reelStop_${r}`].balance);
	for (let i = 1; i < 5; i++) if (!(bal[i] > bal[i - 1])) fail(`reelStop pan does not move left→right: ${bal.map((b) => b.toFixed(2))}`);

	const tiers = ['tierBig', 'tierGrand', 'tierMega', 'tierLegendary', 'tierMax'].map((n) => byLabel[n]);
	for (let i = 1; i < tiers.length; i++) if (!(tiers[i].dur > tiers[i - 1].dur)) fail(`${tiers[i].label} not longer than ${tiers[i - 1].label}`);

	// loudness balance: one-shots within a sensible window; music clearly under them.
	const db = (x) => 20 * Math.log10(Math.max(1e-9, x));
	const shots = rows.filter((r) => r.kind === 'sfx' && !['countTick', 'uiClick'].includes(r.label));
	const loud = shots.map((r) => db(r.maxWin)).sort((a, b) => a - b);
	const median = loud[Math.floor(loud.length / 2)];
	for (const r of shots) {
		const d = db(r.maxWin) - median;
		if (Math.abs(d) > 9) fail(`${r.label}: short-term loudness ${db(r.maxWin).toFixed(1)} dBFS is ${d.toFixed(1)} dB from the one-shot median`);
	}
	for (const t of ['music_base', 'music_private']) {
		const d = db(byLabel[t].rms) - median;
		if (d > -8) fail(`${t}: rms only ${(-d).toFixed(1)} dB under the one-shot median (want ≥ 8 dB)`);
	}

	// ---- live engine ----
	const live = await page.evaluate(() => check.engine());
	if (live.errors.length) fail(`engine threw: ${live.errors.join(' | ')}`);
	if (live.state === 'running') {
		if (!(live.musicRms > 0.002)) fail(`live: music inaudible (rms ${live.musicRms})`);
		if (live.mutedRms !== 0) fail(`live: setVolume(0) left signal at the output (rms ${live.mutedRms})`);
		if (!(live.sfxRms > 0.005)) fail(`live: sfx inaudible after unmute (rms ${live.sfxRms})`);
		if (live.suspended !== 'suspended') fail(`live: suspend() → state ${live.suspended}`);
		if (live.resumed !== 'running') fail(`live: resume() → state ${live.resumed}`);
	} else {
		console.warn(`(live engine check skipped: AudioContext state "${live.state}")`);
	}

	// ---- report ----
	const pad = (s, n) => String(s).padEnd(n);
	const num = (x, d = 3) => x.toFixed(d).padStart(7);
	console.log(
		`\n${pad('name', 18)}${pad('kind', 9)}${'dur s'.padStart(7)}${'audib s'.padStart(9)}${'peak'.padStart(7)}${'raw pk'.padStart(8)}${'rms'.padStart(7)}${'rms dB'.padStart(8)}${'st.max dB'.padStart(10)}${'~Hz'.padStart(7)}`,
	);
	for (const r of rows)
		console.log(
			`${pad(r.label, 18)}${pad(r.kind, 9)}${num(r.dur, 2)}${num(r.audible, 2).padStart(9)}${num(r.peak)}${num(r.rawPeak).padStart(8)}${num(r.rms)}${db(r.rms).toFixed(1).padStart(8)}${db(r.maxWin).toFixed(1).padStart(10)}${Math.round(r.centroid).toString().padStart(7)}`,
		);
	console.log(`\nkeyLand pitch ladder: ${keys.map((k) => `${k.index}→${k.expectHz.toFixed(0)}Hz${k.argmax === k.index ? ' ✓' : ' ✗'}`).join('  ')}`);
	console.log(`reelStop R-share across reels: ${bal.map((b) => b.toFixed(2)).join(' ')}`);
	console.log(`one-shot loudness median ${median.toFixed(1)} dBFS (short-term max)`);
	console.log(`live engine: ${JSON.stringify({ ...live, errors: live.errors.length })}`);
	if (pageErrors.length) fail(`page errors: ${pageErrors.join(' | ')}`);
	if (WRITE_WAV) console.log(`\nWAV previews → ${OUT}`);
} finally {
	await browser.close();
}

if (failures.length) {
	console.error(`\n✗ ${failures.length} problem(s):\n  - ${failures.join('\n  - ')}`);
	process.exit(1);
}
console.log('\n✓ audio check passed');
