#!/usr/bin/env node
// End-to-end harness: starts tools/mock-rgs.mjs, drives the built game in Chrome via playwright-core,
// and checks RGS call order / balance bookkeeping from the mock's log. See tools/README.md.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const MOCK = path.join(__dirname, 'mock-rgs.mjs');
const require = createRequire(path.join(APP_DIR, 'package.json'));
const { chromium } = require('playwright-core');

// ---------------------------------------------------------------- args

const BOOL_FLAGS = new Set(['headed', 'allowExternal', 'help']);
function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith('--')) throw new Error(`unexpected argument: ${a}`);
		let [k, v] = a.slice(2).split(/=(.*)/s);
		if (v === undefined) v = BOOL_FLAGS.has(k) ? 'true' : argv[++i];
		out[k] = v;
	}
	return out;
}
const args = parseArgs(process.argv.slice(2));
if (args.help) {
	console.log(`e2e.mjs — playwright-core e2e against tools/mock-rgs.mjs

  --static <dir>      built game to serve (default <app>/build)
  --out <dir>         screenshots + logs (default: scratchpad e2e dir)
  --only a,b,...      scenarios: a boot, b spins, c rapid, d bonus, e resume, f replay, g sizes
  --spins <n>         spins in scenario b (default 20)
  --seed <n>          mock RGS seed (default 1234)
  --chrome <path>     Chrome binary (default /Applications/Google Chrome.app/...)
  --replayBook <id>   book id replayed in scenario f (default: shortest plain bonus book)
  --headed            show the browser
  --allowExternal     let non-localhost requests through (still recorded + reported)
  --game <id> --version <v>   replay URL params (default sticky_fruits / 1)`);
	process.exit(0);
}

const OUT = path.resolve(
	args.out ??
		'/private/tmp/claude-501/-Users-brijrajsinhgohil-Desktop-local/423f7da7-6e64-41cf-bbbb-660649ddee77/scratchpad/e2e/',
);
const STATIC = path.resolve(args.static ?? path.join(APP_DIR, 'build'));
const SPINS = Number(args.spins ?? 20);
const SEED = String(args.seed ?? 1234);
const CHROME = args.chrome ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HEADED = args.headed === 'true';
const ALLOW_EXTERNAL = args.allowExternal === 'true';
const GAME_ID = args.game ?? 'sticky_fruits';
const GAME_VERSION = args.version ?? '1';
const RUN = Date.now().toString(36);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const BET = 1_000_000; // default bet the game starts with ($1.00 = 1e6, RGS.md "Understanding Money")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const info = (...m) => console.log(`[e2e ${elapsed()}]`, ...m);
const money = (n) => (n / 1e6).toFixed(2);

// ---------------------------------------------------------------- mock RGS process

let mock;
let PORT;
let BASE;

function startMock() {
	fs.mkdirSync(OUT, { recursive: true });
	const logFile = fs.createWriteStream(path.join(OUT, 'mock-rgs.log'));
	const child = spawn(
		process.execPath,
		[MOCK, '--port', '0', '--preload', '--quietStatic', '--seed', SEED, '--static', STATIC],
		{ stdio: ['ignore', 'pipe', 'pipe'] },
	);
	mock = child;
	child.stderr.on('data', (d) => logFile.write(d));
	return new Promise((resolve, reject) => {
		let ready = null;
		const timer = setTimeout(() => reject(new Error('mock-rgs did not become ready in 120s')), 120_000);
		readline.createInterface({ input: child.stdout }).on('line', (line) => {
			logFile.write(`${line}\n`);
			if (line.startsWith('MOCK_RGS_READY ')) ready = JSON.parse(line.slice('MOCK_RGS_READY '.length));
			if (line.startsWith('MOCK_RGS_BOOKS_LOADED') && ready) {
				clearTimeout(timer);
				resolve(ready);
			}
		});
		child.on('exit', (code) => {
			clearTimeout(timer);
			reject(new Error(`mock-rgs exited with code ${code} (see ${path.join(OUT, 'mock-rgs.log')})`));
		});
	});
}

function adm(method, p, body) {
	return new Promise((resolve, reject) => {
		const data = body ? JSON.stringify(body) : undefined;
		const req = https.request(
			{
				host: '127.0.0.1',
				servername: 'localhost',
				port: PORT,
				path: p,
				method,
				rejectUnauthorized: false,
				headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
			},
			(res) => {
				const chunks = [];
				res.on('data', (c) => chunks.push(c));
				res.on('end', () => {
					const text = Buffer.concat(chunks).toString('utf8');
					try {
						const json = JSON.parse(text);
						if (res.statusCode !== 200) reject(new Error(`${method} ${p} -> ${res.statusCode} ${text}`));
						else resolve(json);
					} catch {
						reject(new Error(`${method} ${p} -> ${res.statusCode} non-JSON: ${text.slice(0, 200)}`));
					}
				});
			},
		);
		req.on('error', reject);
		if (data) req.write(data);
		req.end();
	});
}
const mockState = (sid, since = 0) =>
	adm('GET', `/__admin/state?${new URLSearchParams({ ...(sid ? { sessionID: sid } : {}), since: String(since) })}`);
const rgsLog = async (sid, since = 0) => (await mockState(sid, since)).log;
const session = async (sid) => (await mockState(sid, 1e12)).sessions[0];
const currentSeq = async () => (await mockState(null, 1e12)).seq;
const findBooks = async (q) => (await adm('GET', `/__admin/find?${new URLSearchParams(q)}`)).books;

// ---------------------------------------------------------------- polling

async function until(fn, { timeout, interval = 250, onTick, label }) {
	const start = Date.now();
	let tick = 0;
	for (;;) {
		const v = await fn();
		if (v) return v;
		if (Date.now() - start > timeout) throw new Error(`timeout (${timeout / 1000}s) waiting for ${label}`);
		if (onTick) await onTick(tick++, Date.now() - start);
		await sleep(interval);
	}
}

// ---------------------------------------------------------------- browser harness

let browser;

class Scenario {
	constructor(key, name) {
		this.key = key;
		this.name = name;
		this.notes = [];
		this.failures = [];
		this.dir = path.join(OUT, `${key}-${name}`);
		fs.rmSync(this.dir, { recursive: true, force: true });
		fs.mkdirSync(this.dir, { recursive: true });
		this.shotN = 0;
		this.pages = [];
	}
	note(m) {
		this.notes.push(m);
		info(`  ${this.key}: ${m}`);
	}
	fail(m) {
		this.failures.push(m);
		info(`  ${this.key}: FAIL ${m}`);
	}
	check(cond, m) {
		if (!cond) this.fail(m);
		return cond;
	}
	async shot(g, label) {
		const file = path.join(this.dir, `${String(++this.shotN).padStart(2, '0')}-${label}.png`);
		try {
			await g.page.screenshot({ path: file, timeout: 15_000 });
		} catch (err) {
			this.note(`screenshot ${label} failed: ${err.message.split('\n')[0]}`);
		}
		return file;
	}
}

function gameUrl(params) {
	// e2e=1 installs the game's read-only state probe (src/game/e2eProbe.ts)
	const qs = new URLSearchParams({ rgs_url: `localhost:${PORT}`, lang: 'en', currency: 'USD', device: 'desktop', e2e: '1', ...params });
	for (const [k, v] of [...qs]) if (v === 'null') qs.delete(k);
	return `${BASE}/index.html?${qs}`;
}

async function openGame(sc, { sid, params = {}, viewport = { width: 1366, height: 768 }, mobile = false } = {}) {
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport,
		deviceScaleFactor: 1,
		isMobile: mobile,
		hasTouch: mobile,
	});
	const page = await context.newPage();
	const g = { context, page, viewport, sid, phase: 'load', console: [], pageErrors: [], external: [] };
	sc.pages.push(g);
	await context.route('**/*', (route) => {
		const url = route.request().url();
		const u = new URL(url);
		if (LOCAL_HOSTS.has(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
		g.external.push(url);
		return ALLOW_EXTERNAL ? route.continue() : route.abort('blockedbyclient');
	});
	page.on('websocket', (ws) => {
		if (!LOCAL_HOSTS.has(new URL(ws.url()).hostname)) g.external.push(ws.url());
	});
	page.on('console', (msg) => {
		if (msg.type() !== 'error') return;
		const loc = msg.location()?.url ?? '';
		const text = msg.text();
		const blocked = text.includes('ERR_BLOCKED_BY_CLIENT') || g.external.some((e) => loc.startsWith(e));
		g.console.push({ phase: g.phase, text, url: loc, blocked });
	});
	page.on('pageerror', (err) => g.pageErrors.push({ phase: g.phase, text: String(err?.stack ?? err) }));
	page.on('crash', () => g.pageErrors.push({ phase: g.phase, text: 'page crashed' }));
	await page.goto(gameUrl({ sessionID: sid ?? 'null', ...params }), { waitUntil: 'domcontentloaded', timeout: 60_000 });
	return g;
}

const clickCentre = (g) => g.page.mouse.click(g.viewport.width / 2, g.viewport.height / 2);

// fraction of pixels (on a 160px-wide downsample) that changed noticeably between two PNG screenshots.
// Decoded in a blank helper page so we need no PNG library.
let diffPage;
async function imageDiff(a, b) {
	if (!diffPage) diffPage = await (await browser.newContext()).newPage();
	return diffPage.evaluate(
		async ([a64, b64]) => {
			const load = async (s) => createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob());
			const [ia, ib] = await Promise.all([load(a64), load(b64)]);
			const W = 160;
			const H = Math.max(1, Math.round((W * ia.height) / ia.width));
			const px = (img) => {
				const ctx = new OffscreenCanvas(W, H).getContext('2d');
				ctx.drawImage(img, 0, 0, W, H);
				return ctx.getImageData(0, 0, W, H).data;
			};
			const pa = px(ia);
			const pb = px(ib);
			let changed = 0;
			for (let i = 0; i < pa.length; i += 4) {
				const d = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
				if (d > 60) changed++;
			}
			return changed / (W * H);
		},
		[a.toString('base64'), b.toString('base64')],
	);
}

// wait for the loading screen to finish, then click/tap the centre to dismiss "TAP TO PLAY".
// Entry is confirmed when a large part of the screen changes versus the loading screen; if it
// didn't (clicked before the prompt was live), click again.
async function enterGame(sc, g, { shots = true } = {}) {
	g.phase = 'load';
	await g.page.waitForSelector('canvas', { state: 'attached', timeout: 60_000 });
	await g.page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => sc.note('networkidle not reached in 90s'));
	await sleep(1500);
	const loading = await g.page.screenshot();
	if (shots) await sc.shot(g, 'loading');
	let diff = 0;
	for (let attempt = 0; attempt < 6; attempt++) {
		await clickCentre(g);
		g.phase = 'game';
		await sleep(2500);
		diff = await imageDiff(loading, await g.page.screenshot());
		if (diff > 0.2) break;
		await sleep(1500);
	}
	if (shots) await sc.shot(g, 'entered');
	if (diff <= 0.2) sc.note(`screen changed only ${(diff * 100).toFixed(0)}% after tapping the loading screen`);
	return diff > 0.2;
}

const realConsole = (g, phase) => g.console.filter((c) => !c.blocked && (!phase || c.phase === phase));
const short = (s, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s).replace(/\s+/g, ' ');

// common runtime-health check used by every scenario after boot
function checkRuntimeHealth(sc, g) {
	const pe = g.pageErrors;
	sc.check(pe.length === 0, `${pe.length} uncaught page error(s): ${pe.map((e) => short(e.text)).join(' | ')}`);
	const rc = realConsole(g, 'game');
	sc.check(rc.length === 0, `${rc.length} console error(s) during play: ${[...new Set(rc.map((e) => short(e.text)))].join(' | ')}`);
	const lc = realConsole(g, 'load');
	if (lc.length) sc.note(`${lc.length} load-time console error(s) (asserted in boot)`);
	if (g.external.length) sc.note(`${g.external.length} external request(s) (asserted in boot)`);
}

// ---------------------------------------------------------------- RGS flow helpers

// press Space (and occasionally tap the centre) until a new /wallet/play shows up
async function startSpin(sc, g, since, { timeout = 120_000 } = {}) {
	let presses = 0;
	return until(async () => (await rgsLog(g.sid, since)).find((e) => e.path === '/wallet/play'), {
		timeout,
		interval: 200,
		label: '/wallet/play after Space',
		onTick: async (tick) => {
			if (tick % 15 !== 0) return; // every ~3 s
			presses++;
			if (presses % 3 === 0) await clickCentre(g);
			await g.page.keyboard.press('Space');
		},
	});
}

// wait until the round started by `play` is finished on the RGS side; taps centre every 2 s for bonus panels
async function finishRound(sc, g, play, { timeout = 300_000, shotEvery = 0, label = 'round' } = {}) {
	if (play.status !== 200) throw new Error(`/wallet/play failed: ${play.status} ${play.error} ${play.message}`);
	const r = play.round;
	let lastShot = Date.now();
	let lastClick = Date.now();
	let n = 0;
	const onTick = async () => {
		if (shotEvery && Date.now() - lastShot >= shotEvery && n < 40) {
			lastShot = Date.now();
			n++;
			await sc.shot(g, `${label}-${n}`);
		}
		if (r.bonus && Date.now() - lastClick >= 2000) {
			lastClick = Date.now();
			await clickCentre(g);
		}
	};
	if (!r.active) return null;
	return until(
		async () =>
			(await rgsLog(g.sid, play.seq)).find((e) => e.path === '/wallet/end-round' && e.round?.roundID === r.roundID),
		{ timeout, interval: 250, label: `end-round of round ${r.roundID} (book ${r.bookID})`, onTick },
	);
}

// wait until the session has no active round and no RGS traffic for `quietMs`
async function settle(sc, g, { timeout = 240_000, quietMs = 4000 } = {}) {
	let lastSeq = -1;
	let quietSince = Date.now();
	let lastClick = 0;
	await until(
		async () => {
			const st = await mockState(g.sid, 0);
			const s = st.sessions[0];
			const seqNow = st.log.length ? st.log[st.log.length - 1].seq : 0;
			if (seqNow !== lastSeq) {
				lastSeq = seqNow;
				quietSince = Date.now();
			}
			if (s?.activeRound) {
				if (Date.now() - lastClick > 2000) {
					lastClick = Date.now();
					await clickCentre(g);
				}
				return false;
			}
			return Date.now() - quietSince >= quietMs;
		},
		{ timeout, interval: 300, label: 'session to settle (no active round, no traffic)' },
	);
}

// validate the order of RGS calls and re-derive the balance from the log
function auditLog(sc, log, { startBalance, endBalance, expectBet = BET }) {
	const problems = [];
	let active = null;
	let debit = 0;
	let payout = 0;
	let plays = 0;
	let wins = 0;
	let bonuses = 0;
	let maxInFlight = 0;
	for (const e of log) {
		if (e.path === '/wallet/authenticate') {
			if (e.round?.active) active = e.round.roundID;
		} else if (e.path === '/wallet/play') {
			maxInFlight = Math.max(maxInFlight, e.inFlightAtStart ?? 1);
			if (e.status !== 200) {
				problems.push(`play #${e.seq} -> ${e.status} ${e.error}: ${e.message}`);
				continue;
			}
			if (active) problems.push(`play #${e.seq} while round ${active} active`);
			if (expectBet && e.amount !== expectBet) problems.push(`play #${e.seq} amount ${e.amount} != ${expectBet}`);
			plays++;
			debit += e.round.debit;
			if (e.round.payoutMultiplier > 0) wins++;
			if (e.round.bonus) bonuses++;
			active = e.round.active ? e.round.roundID : null;
		} else if (e.path === '/wallet/end-round') {
			if (e.status !== 200) problems.push(`end-round #${e.seq} -> ${e.status} ${e.error}: ${e.message}`);
			else if (!active) problems.push(`end-round #${e.seq} with no active round`);
			else {
				payout += e.payout;
				active = null;
			}
		} else if (e.path === '/bet/event') {
			if (e.status !== 200) problems.push(`event #${e.seq} -> ${e.status}`);
			if (!active) problems.push(`event #${e.seq} (${e.event}) with no active round`);
		} else if (e.status !== 200) problems.push(`${e.path} #${e.seq} -> ${e.status} ${e.error}`);
	}
	if (maxInFlight > 1) problems.push(`${maxInFlight} /wallet/play requests in flight at once`);
	if (active) problems.push(`round ${active} still active at end`);
	const expected = startBalance - debit + payout;
	sc.check(problems.length === 0, `RGS call order: ${problems.join('; ')}`);
	sc.check(
		expected === endBalance,
		`balance mismatch: start ${money(startBalance)} - bets ${money(debit)} + payouts ${money(payout)} = ${money(expected)} but mock has ${money(endBalance)}`,
	);
	sc.note(
		`${plays} plays (${wins} wins, ${bonuses} bonus), Σbet ${money(debit)}, Σpayout ${money(payout)}, balance ${money(startBalance)} -> ${money(endBalance)}, max plays in flight ${maxInFlight}`,
	);
	return { plays, wins, bonuses, debit, payout, maxInFlight };
}

// ---------------------------------------------------------------- scenarios

async function scBoot(sc) {
	const sid = `e2e-a-${RUN}`;
	const seq0 = await currentSeq();
	const g = await openGame(sc, { sid });
	await g.page.waitForSelector('canvas', { state: 'attached', timeout: 60_000 });
	const entered = await enterGame(sc, g);
	sc.check(entered, 'screen did not change after tapping the loading screen (game not entered?)');
	await sleep(2000);
	await sc.shot(g, 'idle');

	const log = await rgsLog(null, seq0);
	const auth = log.find((e) => e.path === '/wallet/authenticate' && e.sessionID === sid);
	sc.check(auth?.status === 200, '/wallet/authenticate not called (or failed)');
	const canvas = await g.page.evaluate(() => {
		const c = document.querySelector('canvas');
		return c && { w: c.clientWidth, h: c.clientHeight };
	});
	sc.check(canvas && canvas.w > 0 && canvas.h > 0, 'no visible canvas');
	sc.note(`canvas ${canvas?.w}x${canvas?.h}`);

	const hosts = [...new Set(g.external.map((u) => new URL(u).host))];
	sc.check(
		g.external.length === 0,
		`${g.external.length} request(s) to non-localhost hosts${ALLOW_EXTERNAL ? '' : ' (blocked)'}: ${hosts.join(', ')} — ${[...new Set(g.external)].map((u) => short(u, 90)).join(' , ')}`,
	);
	sc.check(g.pageErrors.length === 0, `uncaught page errors: ${g.pageErrors.map((e) => short(e.text)).join(' | ')}`);
	const rc = realConsole(g);
	sc.check(rc.length === 0, `${rc.length} console error(s): ${[...new Set(rc.map((e) => `[${e.phase}] ${short(e.text)}`))].join(' | ')}`);
	const blocked = g.console.filter((c) => c.blocked).length;
	if (blocked) sc.note(`${blocked} console error(s) caused by blocked external requests`);
}

async function scSpins(sc) {
	const sid = `e2e-b-${RUN}`;
	const g = await openGame(sc, { sid });
	await enterGame(sc, g);
	const startBalance = (await session(sid)).balance;
	const since = await currentSeq();
	for (let i = 1; i <= SPINS; i++) {
		const before = await currentSeq();
		const play = await startSpin(sc, g, before);
		const end = await finishRound(sc, g, play, { label: `spin${i}` });
		const r = play.round;
		info(`  b: spin ${i}/${SPINS} book ${r.bookID} x${r.payoutMultiplier}${r.bonus ? ' BONUS' : ''}${end ? ' ended' : ''}`);
		await sleep(1500);
		if (i === 1 || i === SPINS || r.payoutMultiplier > 0) await sc.shot(g, `spin${i}-x${r.payoutMultiplier}`);
	}
	await settle(sc, g);
	await sc.shot(g, 'final');
	const s = await session(sid);
	auditLog(sc, await rgsLog(sid, since), { startBalance, endBalance: s.balance });
	const viol = (await mockState(sid)).violations;
	sc.check(viol.length === 0, `mock violations: ${JSON.stringify(viol)}`);
	checkRuntimeHealth(sc, g);
}

async function scRapid(sc) {
	const sid = `e2e-c-${RUN}`;
	const g = await openGame(sc, { sid });
	await enterGame(sc, g);
	const startBalance = (await session(sid)).balance;
	const since = await currentSeq();
	await adm('POST', '/__admin/config', { latency: 250 }); // widen the window for double-submits
	const { width: w, height: h } = g.viewport;
	try {
		for (let i = 0; i < 30; i++) {
			const k = i % 3;
			if (k === 0) await g.page.keyboard.press('Space');
			else if (k === 1) await g.page.mouse.click(w / 2, h / 2);
			else await g.page.mouse.click(w / 2, h * 0.93);
			if (i === 15) await sc.shot(g, 'hammering');
			await sleep(100);
		}
	} finally {
		await adm('POST', '/__admin/config', { latency: 0 });
	}
	await settle(sc, g);
	await sc.shot(g, 'settled');
	const s = await session(sid);
	const res = auditLog(sc, await rgsLog(sid, since), { startBalance, endBalance: s.balance, expectBet: null });
	sc.check(res.plays >= 1, 'hammering produced no /wallet/play at all');
	const viol = (await mockState(sid)).violations;
	sc.check(viol.length === 0, `mock violations: ${JSON.stringify(viol)}`);
	checkRuntimeHealth(sc, g);
}

let FIXTURES;
async function fixtures() {
	if (FIXTURES) return FIXTURES;
	const shortest = (books, what) => {
		if (!books.length) throw new Error(`no book found for ${what}`);
		return [...books].sort((a, b) => a.events - b.events)[0];
	};
	FIXTURES = {
		retrigger: shortest(await findBooks({ has: 'freeSpinRetrigger', minPayout: '0.01', limit: '40' }), 'freeSpinRetrigger'),
		wincap: shortest(await findBooks({ has: 'wincap', limit: '20' }), 'wincap'),
		bigBase: shortest(await findBooks({ not: 'freeSpinTrigger', minPayout: '15', limit: '20' }), 'base win >= 15x'),
		bonus: shortest(
			await findBooks({ has: 'freeSpinTrigger', not: 'freeSpinRetrigger,wincap', minPayout: '1', limit: '40' }),
			'plain bonus',
		),
	};
	info(
		`fixtures: ${Object.entries(FIXTURES)
			.map(([k, b]) => `${k}=#${b.id} (x${b.x}, ${b.events} events, ${b.reveals} reveals)`)
			.join(', ')}`,
	);
	return FIXTURES;
}

async function scBonus(sc) {
	const fx = await fixtures();
	const sid = `e2e-d-${RUN}`;
	const g = await openGame(sc, { sid });
	await enterGame(sc, g);
	const startBalance = (await session(sid)).balance;
	const since = await currentSeq();
	for (const [label, book] of [
		['retrigger', fx.retrigger],
		['wincap', fx.wincap],
		['bigbase', fx.bigBase],
	]) {
		await adm('POST', '/__admin/force', { ids: [book.id] });
		const before = await currentSeq();
		const play = await startSpin(sc, g, before);
		if (!sc.check(play.round?.bookID === book.id, `${label}: expected forced book ${book.id}, got ${play.round?.bookID}`)) continue;
		await sc.shot(g, `${label}-start`);
		const t = Date.now();
		const end = await finishRound(sc, g, play, { shotEvery: 3000, label });
		const expectedPayout = Math.round((play.round.amount * book.payoutMultiplier) / 100);
		sc.check(end?.payout === expectedPayout, `${label}: end-round payout ${end?.payout} != ${expectedPayout}`);
		// let the post-round presentation (big win / outro) play out
		for (let i = 1; i <= 3; i++) {
			await sleep(2000);
			await sc.shot(g, `${label}-after-${i}`);
		}
		await settle(sc, g, { quietMs: 3000 });
		sc.note(`${label} book #${book.id} x${book.x}: round ${play.round.roundID} ended after ${((Date.now() - t) / 1000).toFixed(0)}s`);
	}
	const s = await session(sid);
	auditLog(sc, await rgsLog(sid, since), { startBalance, endBalance: s.balance });
	checkRuntimeHealth(sc, g);
}

async function scResume(sc) {
	const fx = await fixtures();
	const book = fx.bonus;
	const sid = `e2e-e-${RUN}`;
	const g = await openGame(sc, { sid });
	await enterGame(sc, g);
	const startBalance = (await session(sid)).balance;
	const since = await currentSeq();
	await adm('POST', '/__admin/force', { ids: [book.id] });
	const play = await startSpin(sc, g, since);
	sc.check(play.round?.bookID === book.id, `expected forced book ${book.id}, got ${play.round?.bookID}`);
	sc.check(play.round?.active === true, 'bonus round not active after play');
	// tap through the intro until a /bet/event from inside the free spins is recorded (event "0" is the
	// base-game trigger reveal, sent immediately after play — reloading then would not be "mid-bonus")
	let lastClick = 0;
	const firstEvent = await until(
		async () => (await rgsLog(sid, play.seq)).find((e) => e.path === '/bet/event' && Number(e.event) > 0),
		{
		timeout: 90_000,
		label: 'first free-spin /bet/event',
		onTick: async () => {
			if (Date.now() - lastClick > 2000) {
				lastClick = Date.now();
				await clickCentre(g);
			}
		},
		},
	);
	await sleep(1500);
	const evs = (await rgsLog(sid, play.seq)).filter((e) => e.path === '/bet/event');
	const lastEvent = evs[evs.length - 1].event;
	sc.note(`first free-spin /bet/event "${firstEvent.event}", last before reload "${lastEvent}"`);
	await sc.shot(g, 'before-reload');

	const reloadSeq = await currentSeq();
	g.phase = 'load';
	await g.page.reload({ waitUntil: 'domcontentloaded' });
	const auth = await until(async () => (await rgsLog(sid, reloadSeq)).find((e) => e.path === '/wallet/authenticate'), {
		timeout: 60_000,
		label: 'authenticate after reload',
	});
	// the mock may have received further /bet/event calls between our read and the reload
	const evsBefore = (await rgsLog(sid, play.seq)).filter((e) => e.path === '/bet/event' && e.seq < auth.seq);
	const storedEvent = evsBefore.length ? evsBefore[evsBefore.length - 1].event : null;
	sc.check(
		auth.round?.active === true && auth.round?.roundID === play.round.roundID,
		`authenticate after reload did not return the active round (got ${JSON.stringify(auth.round)})`,
	);
	sc.check(auth.round?.event === storedEvent, `authenticate round.event ${auth.round?.event} != last stored event ${storedEvent}`);
	await enterGame(sc, g);
	const end = await finishRound(sc, g, { ...play, seq: reloadSeq }, { shotEvery: 3000, label: 'resumed' });
	sc.check(!!end, 'end-round not called after resume');
	for (let i = 1; i <= 2; i++) {
		await sleep(2000);
		await sc.shot(g, `after-${i}`);
	}
	await settle(sc, g, { quietMs: 3000 });
	const after = await rgsLog(sid, reloadSeq);
	const extraPlays = after.filter((e) => e.path === '/wallet/play');
	sc.check(extraPlays.length === 0, `${extraPlays.length} /wallet/play call(s) during resume`);
	const resumedEvents = after.filter((e) => e.path === '/bet/event').map((e) => Number(e.event));
	if (resumedEvents.length) {
		sc.check(
			resumedEvents[0] >= Number(storedEvent),
			`resumed /bet/event restarted at ${resumedEvents[0]} (< stored ${storedEvent}) — bonus replayed from earlier point`,
		);
	}
	sc.note(`resumed round ${play.round.roundID} (book #${book.id}) from event ${storedEvent}; /bet/event after reload: ${resumedEvents.join(',') || 'none'}`);
	const s = await session(sid);
	auditLog(sc, await rgsLog(sid, since), { startBalance, endBalance: s.balance });
	checkRuntimeHealth(sc, g);
}

async function scReplay(sc) {
	const fx = await fixtures();
	// plain bonus book (retrigger books are covered by scenario d); override with --replayBook <id>
	const book = args.replayBook ? { id: Number(args.replayBook), x: '?' } : fx.bonus;
	const seq0 = await currentSeq();
	const params = { replay: 'true', game: GAME_ID, version: GAME_VERSION, mode: 'base', event: String(book.id), amount: String(BET) };
	const g = await openGame(sc, { sid: null, params });
	sc.note(`url ${short(gameUrl({ sessionID: 'null', ...params }), 220)}`);
	await enterGame(sc, g);
	for (let i = 1; i <= 10; i++) {
		await sleep(3000);
		await sc.shot(g, `replay-${i}`);
		await clickCentre(g);
	}
	const log = (await rgsLog(null, seq0)).filter((e) => e.kind === 'rgs');
	const replays = log.filter((e) => e.path.startsWith('/bet/replay/'));
	const others = log.filter((e) => !e.path.startsWith('/bet/replay/'));
	const expectPath = `/bet/replay/${GAME_ID}/${GAME_VERSION}/base/${book.id}`;
	sc.check(replays.length >= 1 && replays.every((e) => e.status === 200), `replay endpoint not called successfully (${JSON.stringify(replays.map((e) => [e.path, e.status]))})`);
	sc.check(replays.some((e) => e.path === expectPath), `expected GET ${expectPath}`);
	sc.check(others.length === 0, `wallet/bet calls in replay mode: ${others.map((e) => `${e.method} ${e.path}`).join(', ')}`);
	sc.note(`replayed book #${book.id} (x${book.x}); RGS calls: ${log.map((e) => `${e.method} ${e.path}`).join(', ')}`);
	checkRuntimeHealth(sc, g);
}

async function scSizes(sc) {
	const sizes = [
		[1920, 1080],
		[1366, 768],
		[1024, 576],
		[800, 450],
		[400, 225],
		[425, 812],
		[390, 844],
		[768, 1024],
	];
	for (const [width, height] of sizes) {
		const mobile = height > width;
		const device = mobile ? 'mobile' : 'desktop';
		const label = `${width}x${height}-${device}`;
		const g = await openGame(sc, { sid: `e2e-g-${width}x${height}-${RUN}`, viewport: { width, height }, mobile, params: { device } });
		try {
			await enterGame(sc, g, { shots: false });
			await sleep(1000);
			await sc.shot(g, label);
			const m = await g.page.evaluate(() => {
				const c = document.querySelector('canvas');
				const de = document.documentElement;
				return {
					canvas: c ? [c.clientWidth, c.clientHeight] : null,
					scroll: [de.scrollWidth, de.scrollHeight],
					inner: [innerWidth, innerHeight],
				};
			});
			sc.check(m.scroll[0] <= m.inner[0] + 1 && m.scroll[1] <= m.inner[1] + 1, `${label}: page scrolls (${m.scroll} > ${m.inner})`);
			sc.check(!!m.canvas && m.canvas[0] > 0, `${label}: no canvas`);
			const pe = g.pageErrors;
			const rc = realConsole(g, 'game');
			sc.check(pe.length === 0, `${label}: page errors ${pe.map((e) => short(e.text)).join(' | ')}`);
			sc.check(rc.length === 0, `${label}: console errors ${[...new Set(rc.map((e) => short(e.text)))].join(' | ')}`);
			sc.note(`${label}: canvas ${m.canvas?.join('x')}`);
		} finally {
			await g.context.close();
		}
	}
}

// ---------------------------------------------------------------- bought features (h–l, f2)

// Canvas positions at the default 1366 x 768 viewport, from src/ui/layout.ts (layout.buy) and
// src/buy/BuyMenu.svelte (menu scale 0.9756 around the centre; cards at x -400/0/400, buttons
// 256 below centre; confirm/back at ±135, 80). Update if those layouts change.
const BUY_UI = {
	button: [185, 360],
	card: { BONUS: [293, 634], SUPER: [683, 634], HUNT: [1073, 634] },
	confirm: [551, 462],
};
const COST = { bonus: 129, super: 771, hunt: 3 };
const AUTO_BUTTON = [568, 712]; // layout.auto at 1366 x 768
const probe = (g) => g.page.evaluate(() => window.__gildedSalon?.state() ?? null);

// The plaque is disabled until the round (and its win presentation) is over: retry until the menu
// visibly opens (most of the screen dims). Returns false if it never opened.
async function openBuyMenu(sc, g, label, { attempts = 8 } = {}) {
	let opened = false;
	for (let i = 0; i < attempts && !opened; i++) {
		const before = await g.page.screenshot();
		await g.page.mouse.click(...BUY_UI.button);
		await sleep(1200);
		opened = (await imageDiff(before, await g.page.screenshot())) > 0.3;
		if (!opened) await sleep(1500);
	}
	if (label) await sc.shot(g, label);
	return opened;
}

// buy a bonus (or flip Bonus Hunt) through the menu; returns nothing, the caller watches the RGS log
async function useMenu(sc, g, mode, { confirm = true, label, expectOpen = true } = {}) {
	const opened = await openBuyMenu(sc, g, label && `${label}-menu`, { attempts: expectOpen ? 8 : 2 });
	if (expectOpen) sc.check(opened, `${label ?? mode}: buy menu did not open`);
	await g.page.mouse.click(...BUY_UI.card[mode]);
	await sleep(900);
	if (mode !== 'HUNT' && confirm) {
		if (label) await sc.shot(g, `${label}-confirm`);
		await g.page.mouse.click(...BUY_UI.confirm);
	}
}

const modeOf = (e) => String(e.mode ?? '').toLowerCase();
const nextPlay = (sid, since, timeout = 30_000) =>
	until(async () => (await rgsLog(sid, since)).find((e) => e.path === '/wallet/play'), { timeout, label: '/wallet/play' });
async function noPlay(sid, since, ms) {
	await sleep(ms);
	return !(await rgsLog(sid, since)).some((e) => e.path === '/wallet/play');
}

async function scBuy(sc) {
	const sid = `e2e-h-${RUN}`;
	const g = await openGame(sc, { sid });
	await enterGame(sc, g);
	const startBalance = (await session(sid)).balance;
	const since = await currentSeq();
	await useMenu(sc, g, 'BONUS', { label: 'buy' });
	const play = await nextPlay(sid, since);
	sc.check(modeOf(play) === 'bonus', `bought round sent mode ${play.mode}, expected bonus`);
	sc.check(play.round?.debit === COST.bonus * BET, `bought round debit ${play.round?.debit} != ${COST.bonus * BET}`);
	sc.check(play.round?.bonus === true, 'bought round has no freeSpinTrigger');

	// the bought round ends with the mode still BONUS; holding Space afterwards must play ordinary spins.
	// (A hold started during the bonus presentations is suspended there, like for any bonus.)
	await finishRound(sc, g, play, { shotEvery: 4000, label: 'bought' });
	await settle(sc, g, { quietMs: 3000 });
	const afterBuy = await probe(g);
	sc.note(`mode after the bought round: ${afterBuy?.mode}`);
	const s1 = await currentSeq();
	await g.page.keyboard.down('Space');
	let held = [];
	try {
		held = await until(
			async () => {
				const plays = (await rgsLog(sid, s1)).filter((e) => e.path === '/wallet/play');
				return plays.length >= 2 ? plays : null;
			},
			{ timeout: 120_000, label: '2 held-Space rounds after the buy' },
		);
	} finally {
		await g.page.keyboard.up('Space');
	}
	for (const p of held) sc.check(modeOf(p) === 'base', `held-Space round after the buy sent mode ${p.mode}`);
	await settle(sc, g);

	// autoplay right after a buy
	const s2 = await currentSeq();
	await useMenu(sc, g, 'BONUS', { label: 'buy2' });
	const play2 = await nextPlay(sid, s2);
	sc.check(modeOf(play2) === 'bonus', `second buy sent mode ${play2.mode}`);
	await finishRound(sc, g, play2);
	await settle(sc, g, { quietMs: 3000 });
	const s3 = await currentSeq();
	await g.page.mouse.click(...AUTO_BUTTON);
	await sleep(1000);
	// the SDK panel's option spans sit under a styled overlay; dispatch the clicks on them directly
	await g.page.locator('[data-test="round-options"]').first().dispatchEvent('click');
	await sleep(300);
	await sc.shot(g, 'autoplay-panel');
	await g.page.getByRole('button', { name: 'START AUTOPLAY' }).first().dispatchEvent('click');
	const auto = await until(
		async () => {
			const plays = (await rgsLog(sid, s3)).filter((e) => e.path === '/wallet/play');
			return plays.length >= 3 ? plays : null;
		},
		{ timeout: 120_000, label: '3 autoplay rounds after a buy' },
	);
	await g.page.mouse.click(...AUTO_BUTTON); // stop autoplay
	for (const p of auto) sc.check(modeOf(p) === 'base', `autoplay round after a buy sent mode ${p.mode}`);
	await settle(sc, g);
	sc.note(`held-Space rounds ${held.length}, autoplay rounds ${auto.length}, all base`);
	const s = await session(sid);
	auditLog(sc, await rgsLog(sid, since), { startBalance, endBalance: s.balance });
	checkRuntimeHealth(sc, g);
}

async function scSuper(sc) {
	const sid = `e2e-i-${RUN}`;
	const g = await openGame(sc, { sid });
	await enterGame(sc, g);
	const startBalance = (await session(sid)).balance;
	const since = await currentSeq();
	await useMenu(sc, g, 'SUPER', { label: 'super' });
	const play = await nextPlay(sid, since);
	sc.check(modeOf(play) === 'super', `super round sent mode ${play.mode}`);
	sc.check(play.round?.debit === COST.super * BET, `super debit ${play.round?.debit} != ${COST.super * BET}`);
	const book = await adm('GET', `/__admin/book/super/${play.round.bookID}`);
	const types = book.events.map((e) => e.type);
	const opening = types.indexOf('newStickyWilds');
	sc.check(opening >= 0 && opening < types.indexOf('updateFreeSpin'), 'super book has no opening wilds before the first free spin');
	sc.check(book.events[opening]?.newWilds?.length === 2, 'super book opening wilds != 2');
	// tap through the intro, screenshot the opening chips, then reload mid-bonus
	let lastClick = 0;
	await until(async () => (await rgsLog(sid, play.seq)).find((e) => e.path === '/bet/event' && Number(e.event) > opening), {
		timeout: 120_000,
		label: 'free-spin /bet/event after the opening chips',
		onTick: async () => {
			if (Date.now() - lastClick > 2000) {
				lastClick = Date.now();
				await sc.shot(g, `intro-${lastClick}`);
				await clickCentre(g);
			}
		},
	});
	await sleep(1500);
	await sc.shot(g, 'before-reload');
	const pre = await probe(g);
	sc.check(pre?.stickyWilds >= 2 && pre?.freeSpinsTotal >= 12, `before reload: ${JSON.stringify(pre)}`);
	const reloadSeq = await currentSeq();
	g.phase = 'load';
	await g.page.reload({ waitUntil: 'domcontentloaded' });
	await enterGame(sc, g);
	const post = await probe(g);
	// The round resumes at the last recorded event (the spin that was interrupted replays); chips from
	// events before it are restored in place and must never drop again.
	const stored = Number((await rgsLog(sid, play.seq)).filter((e) => e.path === '/bet/event' && e.seq < reloadSeq).pop()?.event);
	const restored = book.events
		.filter((e) => e.type === 'newStickyWilds' && e.index < stored)
		.flatMap((e) => e.newWilds.map(({ reel, row }) => `${reel}-${row}`));
	sc.check(
		restored.length >= 2 && restored.every((cell) => post?.stickyCells?.includes(cell)) && post?.gameType === 'freegame',
		`after reload the chips were not restored: expected ${restored.join(',')}, shown ${JSON.stringify(post)}`,
	);
	const totalBefore = book.events.filter((e) => e.index < stored && e.type === 'updateFreeSpin').pop()?.total;
	sc.check(post?.freeSpinsTotal === totalBefore, `free-spin total after reload ${post?.freeSpinsTotal} != ${totalBefore}`);
	await sleep(20_000);
	const later = await probe(g);
	const again = (later?.droppedCells ?? []).filter((cell) => restored.includes(cell));
	sc.check(again.length === 0, `restored chips dropped again on resume: ${again.join(', ')}`);
	sc.note(`resumed at event ${stored}; restored chips ${restored.join(',')}; dropped after resume ${later?.droppedCells?.join(',') || 'none'}`);
	await sleep(1500);
	await sc.shot(g, 'resumed');
	const end = await finishRound(sc, g, { ...play, seq: reloadSeq }, { shotEvery: 4000, label: 'resumed' });
	sc.check(!!end, 'super round did not end after resume');
	await settle(sc, g, { quietMs: 3000 });
	const extra = (await rgsLog(sid, reloadSeq)).filter((e) => e.path === '/wallet/play');
	sc.check(extra.length === 0, `${extra.length} /wallet/play call(s) during resume`);
	const s = await session(sid);
	auditLog(sc, await rgsLog(sid, since), { startBalance, endBalance: s.balance });
	checkRuntimeHealth(sc, g);
}

async function scHunt(sc) {
	const sid = `e2e-j-${RUN}`;
	const g = await openGame(sc, { sid });
	await enterGame(sc, g);
	const startBalance = (await session(sid)).balance;
	const since = await currentSeq();
	await useMenu(sc, g, 'HUNT', { label: 'hunt-on' });
	await sleep(500);
	await sc.shot(g, 'hunt-on');
	for (let i = 1; i <= 5; i++) {
		const before = await currentSeq();
		const p = await startSpin(sc, g, before);
		sc.check(modeOf(p) === 'hunt' && p.round?.debit === COST.hunt * BET, `hunt spin ${i}: mode ${p.mode}, debit ${p.round?.debit}`);
		await finishRound(sc, g, p);
		await settle(sc, g, { quietMs: 1500 });
	}
	await useMenu(sc, g, 'HUNT', { label: 'hunt-off' });
	const before = await currentSeq();
	const p = await startSpin(sc, g, before);
	sc.check(modeOf(p) === 'base' && p.round?.debit === BET, `after Hunt off: mode ${p.mode}, debit ${p.round?.debit}`);
	await finishRound(sc, g, p);
	await settle(sc, g);
	const s = await session(sid);
	auditLog(sc, await rgsLog(sid, since), { startBalance, endBalance: s.balance });

	// Hunt on with enough for one spin only: after a losing hunt spin, Space must not send a play
	const zero = (await findBooks({ mode: 'hunt', maxPayout: '0', limit: '1' }))[0];
	await adm('POST', '/__admin/config', { balance: { sessionID: sid, amount: 4 * BET } });
	g.phase = 'load';
	await g.page.reload({ waitUntil: 'domcontentloaded' });
	await enterGame(sc, g, { shots: false });
	await useMenu(sc, g, 'HUNT');
	await adm('POST', '/__admin/force', { ids: [zero.id] });
	const s1 = await currentSeq();
	const last = await startSpin(sc, g, s1);
	sc.check(modeOf(last) === 'hunt' && last.round?.payoutMultiplier === 0, `low-balance hunt spin: mode ${last.mode}, x${last.round?.payoutMultiplier}`);
	await settle(sc, g, { quietMs: 2000 });
	const s2 = await currentSeq();
	for (let i = 0; i < 4; i++) {
		await g.page.keyboard.press('Space');
		await sleep(700);
	}
	sc.check(await noPlay(sid, s2, 1500), 'Space sent a Bonus Hunt play the balance (1.00) cannot cover');
	await sc.shot(g, 'hunt-too-low');
	checkRuntimeHealth(sc, g);
}

async function scLow(sc) {
	const sid = `e2e-k-${RUN}`;
	const g = await openGame(sc, { sid });
	await enterGame(sc, g, { shots: false });
	await adm('POST', '/__admin/config', { balance: { sessionID: sid, amount: 50 * BET } });
	g.phase = 'load';
	await g.page.reload({ waitUntil: 'domcontentloaded' });
	await enterGame(sc, g, { shots: false });
	const since = await currentSeq();
	await useMenu(sc, g, 'BONUS', { label: 'low' });
	sc.check((await probe(g))?.buyButtonShown === true, 'low balance: buy plaque not shown');
	sc.check(await noPlay(sid, since, 2500), 'a buy the balance cannot cover sent /wallet/play');
	checkRuntimeHealth(sc, g);
}

async function scNoBuy(sc) {
	await adm('POST', '/__admin/config', { jurisdiction: { disabledBuyFeature: true } });
	try {
		const sid = `e2e-l-${RUN}`;
		const g = await openGame(sc, { sid });
		await enterGame(sc, g);
		const since = await currentSeq();
		await useMenu(sc, g, 'BONUS', { label: 'nobuy', expectOpen: false });
		const st = await probe(g);
		sc.check(st?.buyButtonShown === false && st?.buyMenuOpen === false, `disabledBuyFeature: ${JSON.stringify(st)}`);
		sc.check(await noPlay(sid, since, 2500), 'buy feature disabled, but a play was sent');
		checkRuntimeHealth(sc, g);
	} finally {
		await adm('POST', '/__admin/config', { jurisdiction: { disabledBuyFeature: false } });
	}
}

async function scReplayModes(sc) {
	for (const mode of ['super', 'hunt']) {
		const has = mode === 'hunt' ? { has: 'freeSpinTrigger' } : {};
		const book = (await findBooks({ mode, minPayout: '1', limit: '5', ...has }))[0];
		const seq0 = await currentSeq();
		const params = { replay: 'true', game: GAME_ID, version: GAME_VERSION, mode, event: String(book.id), amount: String(BET) };
		const g = await openGame(sc, { sid: null, params });
		await enterGame(sc, g, { shots: false });
		for (let i = 1; i <= 6; i++) {
			await sleep(3000);
			await sc.shot(g, `${mode}-${i}`);
			await clickCentre(g);
		}
		const st = await probe(g);
		sc.check(st !== null && st.buyButtonShown === false, `${mode} replay: buy plaque shown (${JSON.stringify(st)})`);
		const log = (await rgsLog(null, seq0)).filter((e) => e.kind === 'rgs');
		const expectPath = `/bet/replay/${GAME_ID}/${GAME_VERSION}/${mode}/${book.id}`;
		sc.check(log.some((e) => e.path === expectPath && e.status === 200), `${mode}: expected GET ${expectPath}`);
		sc.check(log.every((e) => e.path.startsWith('/bet/replay/')), `${mode}: wallet/bet calls in replay: ${log.map((e) => e.path).join(', ')}`);
		checkRuntimeHealth(sc, g);
		sc.note(`${mode}: replayed book #${book.id} (x${book.x})`);
		await g.context.close();
	}
}

const SCENARIOS = [
	['a', 'boot', scBoot],
	['b', 'spins', scSpins],
	['c', 'rapid', scRapid],
	['d', 'bonus', scBonus],
	['e', 'resume', scResume],
	['f', 'replay', scReplay],
	['g', 'sizes', scSizes],
	['h', 'buy', scBuy],
	['i', 'super', scSuper],
	['j', 'hunt', scHunt],
	['k', 'low', scLow],
	['l', 'nobuy', scNoBuy],
	['f2', 'replay-modes', scReplayModes],
];

// ---------------------------------------------------------------- main

async function main() {
	const only = args.only ? args.only.split(',').map((s) => s.trim()) : null;
	const selected = SCENARIOS.filter(([k, n]) => !only || only.includes(k) || only.includes(n));
	if (!selected.length) throw new Error(`--only matched no scenario (${args.only})`);
	if (!fs.existsSync(path.join(STATIC, 'index.html'))) throw new Error(`no index.html in --static ${STATIC}`);

	const ready = await startMock();
	PORT = ready.port;
	BASE = `https://localhost:${PORT}`;
	info(`mock RGS on ${BASE} (seed ${SEED}), static ${STATIC}, out ${OUT}`);
	browser = await chromium.launch({
		executablePath: CHROME,
		headless: !HEADED,
		args: ['--mute-audio', '--ignore-gpu-blocklist'],
	});

	const results = [];
	for (const [key, name, fn] of selected) {
		const sc = new Scenario(key, name);
		info(`=== ${key} ${name}`);
		const start = Date.now();
		try {
			await fn(sc);
		} catch (err) {
			sc.fail(`exception: ${short(err?.message ?? String(err), 400)}`);
			for (const g of sc.pages) {
				if (!g.page.isClosed()) await sc.shot(g, 'failure');
				if (g.pageErrors.length) sc.note(`page errors: ${g.pageErrors.map((e) => short(e.text)).join(' | ')}`);
			}
		} finally {
			for (const g of sc.pages) await g.context.close().catch(() => {});
		}
		results.push({
			key,
			name,
			pass: sc.failures.length === 0,
			seconds: Math.round((Date.now() - start) / 100) / 10,
			failures: sc.failures,
			notes: sc.notes,
			screenshots: sc.dir,
		});
	}

	fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ static: STATIC, seed: SEED, results }, null, 2));
	console.log('\nSCENARIO     RESULT  TIME    NOTES');
	console.log('-'.repeat(100));
	for (const r of results) {
		const lines = [...r.failures.map((f) => `FAIL: ${f}`), ...r.notes];
		console.log(`${`${r.key} ${r.name}`.padEnd(12)} ${(r.pass ? 'PASS' : 'FAIL').padEnd(7)} ${`${r.seconds}s`.padEnd(7)} ${lines[0] ?? ''}`);
		for (const l of lines.slice(1)) console.log(`${' '.repeat(28)} ${l}`);
	}
	console.log(`\nscreenshots + mock-rgs.log + summary.json in ${OUT}`);
	return results.every((r) => r.pass) ? 0 : 1;
}

let code = 1;
try {
	code = await main();
} catch (err) {
	console.error(err);
} finally {
	await browser?.close().catch(() => {});
	mock?.kill('SIGTERM');
}
process.exit(code);
