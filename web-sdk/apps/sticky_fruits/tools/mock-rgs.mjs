#!/usr/bin/env node
// Mock Stake Engine RGS + static file server for local play and e2e tests.
// Dependency-free (Node >= 22; uses zlib zstd when available). See tools/README.md.
//
// Protocol references:
//   math-sdk/docs/rgs_docs/RGS.md                      (endpoints, money = int x1e6, error codes)
//   math-sdk/docs/rgs_docs/data_format.md              (index.json / lookup CSV / books .jsonl.zst)
//   web-sdk/packages/rgs-fetcher/src/schema.ts         (request/response object shapes)
//   web-sdk/packages/rgs-requests/src/rgs-requests.ts  (what the frontend sends)
//   web-sdk/packages/components-shared/src/components/Authenticate.svelte (what it reads)
//   web-sdk/packages/utils-xstate/src/createPrimaryMachines.ts (play / end-round timing)

import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APP_DIR, '../../..');
const API = 1_000_000; // RGS.md "Understanding Money": 1_000_000 == 1.00
const BOOK_MULT = 100; // books: payoutMultiplier 100 == 1x bet

// ---------------------------------------------------------------- args

const JURISDICTION_BOOLS = [
	'socialCasino',
	'disabledFullscreen',
	'disabledTurbo',
	'disabledSuperTurbo',
	'disabledAutoplay',
	'disabledSlamstop',
	'disabledSpacebar',
	'disabledBuyFeature',
	'displayNetPosition',
	'displayRTP',
	'displaySessionTimer',
];
const BOOL_FLAGS = new Set([...JURISDICTION_BOOLS, 'social', 'preload', 'quiet', 'quietStatic', 'help']);

function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith('--')) throw new Error(`unexpected argument: ${a}`);
		let [k, v] = a.slice(2).split(/=(.*)/s);
		if (v === undefined) {
			if (BOOL_FLAGS.has(k)) v = 'true';
			else if (i + 1 < argv.length) v = argv[++i];
			else throw new Error(`missing value for --${k}`);
		}
		out[k] = v;
	}
	return out;
}

const USAGE = `mock-rgs.mjs — mock Stake Engine RGS (HTTPS) + static server

  --port <n>                 listen port (default 3443, 0 = random free port)
  --host <addr>              bind address (default: 127.0.0.1 and ::1)
  --static <dir>             static dir served at / (default: <app>/build)
  --library <dir>            math publish_files dir (default: math-sdk/games/sticky_fruits/library/publish_files)
  --seed <n>                 RNG seed for weighted book selection (default: random, printed)
  --force <id,id,...>        book ids returned by the next plays, consumed in order
  --balance <n>              starting balance per new session, currency units (default 1000)
  --currency <code>          currency (default USD)
  --betLevels <a,b,...>      bet levels in currency units (default 0.1,0.2,0.5,1,2,5,10,20,50,100)
  --defaultBetLevel <n>      currency units (default 1)
  --minBet/--maxBet/--stepBet <n>  currency units (default first/last level, 0.01)
  --latency <ms>             delay every RGS response (default 0)
  --social --disabledTurbo --disabledAutoplay --disabledSlamstop --disabledSpacebar
  --disabledFullscreen --disabledSuperTurbo --disabledBuyFeature --displayNetPosition
  --displayRTP --displaySessionTimer   jurisdiction flags (default false)
  --minimumRoundDuration <ms>          jurisdiction value (default 0)
  --cert <pem> --key <pem>   use this TLS cert instead of generating a self-signed one
  --preload                  load books at startup instead of on first use
  --quietStatic              don't log static file requests
  --quiet                    don't log anything except the READY line
`;

const args = parseArgs(process.argv.slice(2));
if (args.help === 'true') {
	process.stdout.write(USAGE);
	process.exit(0);
}
const bool = (k) => args[k] === 'true' || args[k] === '1';
const num = (k, d) => (args[k] === undefined ? d : Number(args[k]));
const toApi = (units) => Math.round(Number(units) * API);

const betLevels = (args.betLevels ?? '0.1,0.2,0.5,1,2,5,10,20,50,100').split(',').map(toApi);
const CONFIG = {
	port: num('port', 3443),
	host: args.host,
	staticDir: path.resolve(args.static ?? path.join(APP_DIR, 'build')),
	libraryDir: path.resolve(
		args.library ?? path.join(REPO_ROOT, 'math-sdk/games/sticky_fruits/library/publish_files'),
	),
	seed: args.seed !== undefined ? String(args.seed) : String(randomBytes(4).readUInt32BE()),
	startBalance: toApi(args.balance ?? 1000),
	currency: args.currency ?? 'USD',
	latency: num('latency', 0),
	quiet: bool('quiet'),
	quietStatic: bool('quietStatic'),
	// RGS.md "Bet Levels" + schema.ts ConfigObject; example in Authenticate.svelte
	config: {
		minBet: args.minBet !== undefined ? toApi(args.minBet) : betLevels[0],
		maxBet: args.maxBet !== undefined ? toApi(args.maxBet) : betLevels[betLevels.length - 1],
		stepBet: toApi(args.stepBet ?? 0.01),
		defaultBetLevel: toApi(args.defaultBetLevel ?? 1),
		betLevels,
		betModes: {},
		jurisdiction: {
			...Object.fromEntries(JURISDICTION_BOOLS.map((k) => [k, bool(k)])),
			socialCasino: bool('social') || bool('socialCasino'),
			minimumRoundDuration: num('minimumRoundDuration', 0),
		},
	},
};

// ---------------------------------------------------------------- logging

const T0 = Date.now();
const ts = () => {
	const d = new Date();
	return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};
const say = (line) => {
	if (!CONFIG.quiet) process.stdout.write(`[mock-rgs ${ts()}] ${line}\n`);
};

// ---------------------------------------------------------------- RNG (splitmix64, seedable)

function makeRng(seedStr) {
	let s = 0n;
	for (const ch of seedStr) s = BigInt.asUintN(64, s * 131n + BigInt(ch.codePointAt(0)));
	return () => {
		s = BigInt.asUintN(64, s + 0x9e3779b97f4a7c15n);
		let z = s;
		z = BigInt.asUintN(64, (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
		z = BigInt.asUintN(64, (z ^ (z >> 27n)) * 0x94d049bb133111ebn);
		return z ^ (z >> 31n);
	};
}
const rng = makeRng(CONFIG.seed);

// ---------------------------------------------------------------- math library

function decompressZst(file) {
	if (typeof zlib.zstdDecompressSync === 'function') {
		return { buf: zlib.zstdDecompressSync(fs.readFileSync(file)), via: 'node:zlib' };
	}
	const maxBuffer = 2 ** 32;
	try {
		return { buf: execFileSync('zstd', ['-dc', file], { maxBuffer }), via: 'zstd cli' };
	} catch {
		/* fall through */
	}
	const py =
		'import sys,zstandard;zstandard.ZstdDecompressor().copy_stream(open(sys.argv[1],"rb"),sys.stdout.buffer)';
	return { buf: execFileSync('python3', ['-c', py, file], { maxBuffer }), via: 'python zstandard' };
}

class ModeBooks {
	constructor(entry) {
		this.name = entry.name;
		this.cost = Number(entry.cost);
		this.eventsFile = path.join(CONFIG.libraryDir, entry.events);
		this.weightsFile = path.join(CONFIG.libraryDir, entry.weights);
		this.loaded = false;
	}

	load() {
		if (this.loaded) return;
		const t = Date.now();
		// lookup table: id,weight,payoutMultiplier (data_format.md "CSV format"), no header
		const rows = fs.readFileSync(this.weightsFile, 'utf8').split(/\r?\n/).filter(Boolean);
		this.lutIds = new Array(rows.length);
		this.cum = new Array(rows.length);
		this.lutPm = new Map();
		let total = 0n;
		rows.forEach((row, i) => {
			const [id, w, pm] = row.split(',');
			total += BigInt(w.trim());
			this.lutIds[i] = Number(id);
			this.cum[i] = total;
			this.lutPm.set(Number(id), Number(pm));
		});
		this.total = total;

		// books: zstd jsonl, one {id, payoutMultiplier, events} per line (data_format.md "Game logic format")
		const { buf, via } = decompressZst(this.eventsFile);
		this.buf = buf;
		const starts = [];
		const ends = [];
		this.lineById = new Map();
		let pos = 0;
		while (pos < buf.length) {
			let end = buf.indexOf(10, pos);
			if (end < 0) end = buf.length;
			if (end > pos) {
				const head = buf.toString('latin1', pos, Math.min(pos + 64, end));
				const m = /"id"\s*:\s*(\d+)/.exec(head);
				const id = m ? Number(m[1]) : JSON.parse(buf.toString('utf8', pos, end)).id;
				this.lineById.set(id, starts.length);
				starts.push(pos);
				ends.push(end);
			}
			pos = end + 1;
		}
		this.starts = Uint32Array.from(starts);
		this.ends = Uint32Array.from(ends);
		this.loaded = true;
		say(
			`loaded mode "${this.name}": ${rows.length} lut rows, ${starts.length} books ` +
				`(${(buf.length / 1e6).toFixed(0)} MB via ${via}) in ${Date.now() - t} ms`,
		);
	}

	has(id) {
		this.load();
		return this.lineById.has(id);
	}

	book(id) {
		this.load();
		const li = this.lineById.get(id);
		if (li === undefined) return null;
		return JSON.parse(this.buf.toString('utf8', this.starts[li], this.ends[li]));
	}

	pickId() {
		this.load();
		const r = this.total <= 2n ** 64n ? rng() % this.total : (rng() * 2n ** 64n + rng()) % this.total;
		let lo = 0;
		let hi = this.cum.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (this.cum[mid] > r) hi = mid;
			else lo = mid + 1;
		}
		return this.lutIds[lo];
	}

	// scan books for test fixtures: has = event types all present, not = event types absent,
	// payout bounds in x (bet multiples)
	find({ has = [], not = [], minPayout, maxPayout, limit = 10 }) {
		this.load();
		const needle = has.length ? Buffer.from(`"${has[0]}"`) : null;
		let candidates;
		if (needle) {
			const set = new Set();
			let p = this.buf.indexOf(needle);
			while (p >= 0) {
				let lo = 0;
				let hi = this.starts.length - 1;
				while (lo < hi) {
					const mid = (lo + hi + 1) >> 1;
					if (this.starts[mid] <= p) lo = mid;
					else hi = mid - 1;
				}
				set.add(lo);
				p = this.buf.indexOf(needle, this.ends[lo] + 1);
			}
			candidates = [...set];
		} else {
			candidates = Array.from({ length: this.starts.length }, (_, i) => i);
		}
		const out = [];
		for (const li of candidates) {
			const raw = this.buf.toString('utf8', this.starts[li], this.ends[li]);
			const head = /"id"\s*:\s*(\d+)/.exec(raw.slice(0, 64));
			const lutPm = head ? this.lutPm.get(Number(head[1])) : undefined;
			if (lutPm !== undefined) {
				if (minPayout !== undefined && lutPm / BOOK_MULT < minPayout) continue;
				if (maxPayout !== undefined && lutPm / BOOK_MULT > maxPayout) continue;
			}
			const b = JSON.parse(raw);
			const x = b.payoutMultiplier / BOOK_MULT;
			if (minPayout !== undefined && x < minPayout) continue;
			if (maxPayout !== undefined && x > maxPayout) continue;
			const types = new Set(b.events.map((e) => e.type));
			if (!has.every((t) => types.has(t))) continue;
			if (not.some((t) => types.has(t))) continue;
			out.push({
				id: b.id,
				payoutMultiplier: b.payoutMultiplier,
				x,
				events: b.events.length,
				reveals: b.events.filter((e) => e.type === 'reveal').length,
				types: [...types],
			});
			if (out.length >= limit) break;
		}
		return out;
	}
}

const indexJson = JSON.parse(fs.readFileSync(path.join(CONFIG.libraryDir, 'index.json'), 'utf8'));
const MODES = new Map(indexJson.modes.map((m) => [m.name.toLowerCase(), new ModeBooks(m)]));
const getMode = (name) => (typeof name === 'string' ? MODES.get(name.toLowerCase()) : undefined);

// ---------------------------------------------------------------- RGS state

const sessions = new Map(); // sessionID -> session
const log = []; // RGS + admin calls (not static)
const violations = [];
let forced = (args.force ? String(args.force).split(',') : [])
	.map((s) => s.trim())
	.filter(Boolean)
	.map(Number);
let seq = 0;
let roundCounter = 100000;
const playInFlight = new Map(); // sessionID -> count

const addViolation = (type, sessionID, detail) => {
	const v = { seq, t: Date.now() - T0, type, sessionID, detail };
	violations.push(v);
	say(`VIOLATION ${type} sid=${sessionID} ${detail ?? ''}`);
};

class RgsError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}
// RGS.md "Response Codes": 400 ERR_VAL/ERR_IPB/ERR_IS/..., 500 ERR_GEN
const fail = (status, code, message) => {
	throw new RgsError(status, code, message);
};

const balanceObj = (s) => ({ amount: s.balance, currency: s.currency });

// schema.ts RoundDetailObject (+ betID as in the Authenticate.svelte example payload)
const publicRound = (r) =>
	r && {
		betID: r.roundID,
		roundID: r.roundID,
		amount: r.amount,
		payout: r.payout,
		payoutMultiplier: r.payoutMultiplier,
		active: r.active,
		mode: r.mode,
		event: r.event,
		state: r.state,
	};
const roundSummary = (r) =>
	r && {
		roundID: r.roundID,
		bookID: r.bookID,
		amount: r.amount,
		debit: r.debit,
		payout: r.payout,
		payoutMultiplier: r.payoutMultiplier,
		active: r.active,
		mode: r.mode,
		event: r.event,
		reveals: r.reveals,
		bonus: r.reveals > 1,
		ended: r.ended,
	};

function requireSession(body) {
	const sid = body?.sessionID;
	if (typeof sid !== 'string' || !sid) fail(400, 'ERR_IS', 'missing sessionID');
	const s = sessions.get(sid);
	if (!s) fail(400, 'ERR_IS', 'invalid session (call /wallet/authenticate first)');
	return s;
}

const rgs = {
	// RGS.md "Authenticate Request"
	'POST /wallet/authenticate': (body, info) => {
		const sid = body?.sessionID;
		if (typeof sid !== 'string' || !sid) fail(400, 'ERR_IS', 'missing sessionID');
		let s = sessions.get(sid);
		if (!s) {
			s = {
				sessionID: sid,
				balance: CONFIG.startBalance,
				currency: CONFIG.currency,
				authCount: 0,
				activeRound: null,
				lastRound: null,
				rounds: 0,
			};
			sessions.set(sid, s);
		}
		s.authCount++;
		info.sessionID = sid;
		info.language = body.language;
		// "The round returned may represent a currently active or the last completed round."
		const round = s.activeRound ?? s.lastRound;
		info.round = roundSummary(round);
		const res = { balance: balanceObj(s), config: CONFIG.config };
		if (round) res.round = publicRound(round);
		return res;
	},

	// RGS.md "Balance Request"
	'POST /wallet/balance': (body, info) => {
		const s = requireSession(body);
		info.balance = s.balance;
		return { balance: balanceObj(s) };
	},

	// RGS.md "Play Request" + "Bet Modes / Cost Multipliers" + "Bet Levels"
	'POST /wallet/play': (body, info) => {
		const s = requireSession(body);
		const { amount, mode } = body;
		info.amount = amount;
		info.mode = mode;
		info.currency = body.currency;
		if (!Number.isInteger(amount)) fail(400, 'ERR_VAL', `amount must be an integer, got ${amount}`);
		const { minBet, maxBet, stepBet } = CONFIG.config;
		if (amount < minBet || amount > maxBet) fail(400, 'ERR_VAL', `amount ${amount} outside [${minBet}, ${maxBet}]`);
		if (amount % stepBet !== 0) fail(400, 'ERR_VAL', `amount ${amount} not divisible by stepBet ${stepBet}`);
		const m = getMode(mode);
		if (!m) fail(400, 'ERR_VAL', `unknown mode ${mode}`);
		if (s.activeRound) {
			addViolation('playWhileActive', s.sessionID, `round ${s.activeRound.roundID} still active`);
			fail(400, 'ERR_BE', `player already has an active bet (round ${s.activeRound.roundID})`);
		}
		const debit = Math.round(amount * m.cost);
		if (s.balance < debit) fail(400, 'ERR_IPB', `insufficient balance ${s.balance} < ${debit}`);

		let bookID;
		while (forced.length && bookID === undefined) {
			const id = forced.shift();
			if (m.has(id)) bookID = id;
			else say(`forced id ${id} not found in mode ${m.name}; skipped`);
		}
		const wasForced = bookID !== undefined;
		if (!wasForced) bookID = m.pickId();
		const book = m.book(bookID);

		s.balance -= debit;
		const pm = book.payoutMultiplier;
		const round = {
			roundID: ++roundCounter,
			bookID,
			amount,
			debit,
			payout: Math.round((amount * pm) / BOOK_MULT),
			payoutMultiplier: pm / BOOK_MULT,
			// a zero-pay round needs no end-round (createPrimaryMachines "noWin"), so the RGS closes it
			active: pm > 0,
			mode,
			event: null,
			state: book.events,
			reveals: book.events.filter((e) => e.type === 'reveal').length,
			ended: pm > 0 ? false : 'auto',
		};
		s.rounds++;
		if (round.active) s.activeRound = round;
		else s.lastRound = round;
		Object.assign(info, { forced: wasForced, round: roundSummary(round), balance: s.balance });
		return { balance: balanceObj(s), round: publicRound(round) };
	},

	// RGS.md "End Round Request"
	'POST /wallet/end-round': (body, info) => {
		const s = requireSession(body);
		const r = s.activeRound;
		if (!r) {
			addViolation('endRoundWithoutActive', s.sessionID);
			fail(400, 'ERR_VAL', 'no active round');
		}
		s.balance += r.payout;
		r.active = false;
		r.ended = true;
		s.activeRound = null;
		s.lastRound = r;
		Object.assign(info, { round: roundSummary(r), payout: r.payout, balance: s.balance });
		return { balance: balanceObj(s) };
	},

	// RGS.md "Game Play / Event"
	'POST /bet/event': (body, info) => {
		const s = requireSession(body);
		info.event = body.event;
		if (body.event !== undefined && typeof body.event !== 'string') fail(400, 'ERR_VAL', 'event must be a string');
		const r = s.activeRound;
		if (r) {
			r.event = body.event ?? null;
			info.roundID = r.roundID;
		} else {
			// not an error on our side (the round may have auto-closed with 0 payout), but worth seeing
			info.warning = 'no active round';
		}
		return { event: body.event };
	},
};

// GET /bet/replay/{game}/{version}/{mode}/{event}  (rgs-requests.ts requestReplay; Authenticate.svelte handleReplay
// spreads the response into betToResume, so it must carry `state` and `payoutMultiplier`)
function replay(parts, info) {
	const [game, version, mode, event] = parts.map(decodeURIComponent);
	Object.assign(info, { game, version, mode, event });
	const m = getMode(mode);
	if (!m) fail(404, 'ERR_VAL', `unknown mode ${mode}`);
	const id = Number(event);
	if (!Number.isInteger(id) || !m.has(id)) fail(404, 'ERR_VAL', `unknown event/book id ${event}`);
	const book = m.book(id);
	info.bookID = id;
	return { payoutMultiplier: book.payoutMultiplier / BOOK_MULT, costMultiplier: m.cost, state: book.events };
}

// ---------------------------------------------------------------- admin

function admin(method, pathname, query, body) {
	if (method === 'GET' && pathname === '/__admin/state') {
		const sid = query.get('sessionID');
		const since = Number(query.get('since') ?? 0);
		const sess = [...sessions.values()]
			.filter((s) => !sid || s.sessionID === sid)
			.map((s) => ({
				sessionID: s.sessionID,
				balance: s.balance,
				currency: s.currency,
				authCount: s.authCount,
				rounds: s.rounds,
				activeRound: roundSummary(s.activeRound),
				lastRound: roundSummary(s.lastRound),
			}));
		return {
			now: Date.now() - T0,
			seq,
			seed: CONFIG.seed,
			latency: CONFIG.latency,
			forced,
			config: CONFIG.config,
			startBalance: CONFIG.startBalance,
			modes: [...MODES.values()].map((m) => ({ name: m.name, cost: m.cost, loaded: m.loaded })),
			sessions: sess,
			playInFlight: Object.fromEntries(playInFlight),
			violations: violations.filter((v) => !sid || v.sessionID === sid),
			log: log.filter((e) => e.seq > since && (!sid || e.sessionID === sid)),
		};
	}
	if (method === 'POST' && pathname === '/__admin/force') {
		const ids = (body?.ids ?? []).map(Number);
		if (ids.some((n) => !Number.isInteger(n))) fail(400, 'ERR_VAL', 'ids must be integers');
		forced = body?.append ? [...forced, ...ids] : ids;
		return { forced };
	}
	if (method === 'POST' && pathname === '/__admin/config') {
		if (body?.latency !== undefined) CONFIG.latency = Number(body.latency);
		if (body?.jurisdiction) Object.assign(CONFIG.config.jurisdiction, body.jurisdiction);
		if (body?.startBalance !== undefined) CONFIG.startBalance = Number(body.startBalance);
		if (body?.balance) {
			const s = sessions.get(body.balance.sessionID);
			if (!s) fail(400, 'ERR_IS', 'unknown session');
			s.balance = Number(body.balance.amount);
		}
		return { latency: CONFIG.latency, startBalance: CONFIG.startBalance, jurisdiction: CONFIG.config.jurisdiction };
	}
	if (method === 'POST' && pathname === '/__admin/reset') {
		sessions.clear();
		log.length = 0;
		violations.length = 0;
		forced = [];
		return { ok: true };
	}
	if (method === 'GET' && pathname === '/__admin/find') {
		const m = getMode(query.get('mode') ?? [...MODES.keys()][0]);
		if (!m) fail(400, 'ERR_VAL', 'unknown mode');
		const list = (k) => (query.get(k) ? query.get(k).split(',').filter(Boolean) : []);
		const opt = (k) => (query.get(k) !== null ? Number(query.get(k)) : undefined);
		return {
			mode: m.name,
			books: m.find({
				has: list('has'),
				not: list('not'),
				minPayout: opt('minPayout'),
				maxPayout: opt('maxPayout'),
				limit: opt('limit') ?? 10,
			}),
		};
	}
	const bm = /^\/__admin\/book\/([^/]+)\/(\d+)$/.exec(pathname);
	if (method === 'GET' && bm) {
		const m = getMode(decodeURIComponent(bm[1]));
		const b = m?.book(Number(bm[2]));
		if (!b) fail(404, 'ERR_VAL', 'book not found');
		return b;
	}
	fail(404, 'ERR_VAL', `unknown admin route ${method} ${pathname}`);
}

// ---------------------------------------------------------------- static files

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.atlas': 'text/plain; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.mp3': 'audio/mpeg',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',
	'.m4a': 'audio/mp4',
	'.webm': 'audio/webm',
	'.mp4': 'video/mp4',
	'.wasm': 'application/wasm',
	'.skel': 'application/octet-stream',
};

function serveStatic(req, res, pathname) {
	let rel;
	try {
		rel = decodeURIComponent(pathname);
	} catch {
		res.writeHead(400).end();
		return 400;
	}
	let file = path.join(CONFIG.staticDir, path.normalize(rel));
	if (file !== CONFIG.staticDir && !file.startsWith(CONFIG.staticDir + path.sep)) {
		res.writeHead(403).end();
		return 403;
	}
	let st;
	try {
		st = fs.statSync(file);
		if (st.isDirectory()) {
			file = path.join(file, 'index.html');
			st = fs.statSync(file);
		}
	} catch {
		res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
		return 404;
	}
	const headers = {
		'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
		'Cache-Control': 'no-store',
		'Accept-Ranges': 'bytes',
	};
	const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
	if (range && (range[1] || range[2])) {
		let start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
		let end = range[1] && range[2] ? Number(range[2]) : st.size - 1;
		start = Math.max(0, start);
		end = Math.min(end, st.size - 1);
		if (start > end) {
			res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end();
			return 416;
		}
		res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
		if (req.method === 'HEAD') res.end();
		else fs.createReadStream(file, { start, end }).pipe(res);
		return 206;
	}
	res.writeHead(200, { ...headers, 'Content-Length': st.size });
	if (req.method === 'HEAD') res.end();
	else fs.createReadStream(file).pipe(res);
	return 200;
}

// ---------------------------------------------------------------- http

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '600',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on('data', (c) => {
			size += c.length;
			if (size > 1e6) reject(new Error('body too large'));
			else chunks.push(c);
		});
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

function sendJson(res, status, obj) {
	const body = JSON.stringify(obj);
	res.writeHead(status, {
		...CORS,
		'Content-Type': 'application/json',
		'Cache-Control': 'no-store',
		'Content-Length': Buffer.byteLength(body),
	});
	res.end(body);
}

const fmtInfo = (info) => {
	const parts = [];
	if (info.sessionID) parts.push(`sid=${info.sessionID}`);
	if (info.amount !== undefined) parts.push(`amount=${info.amount}`);
	if (info.mode !== undefined) parts.push(`mode=${info.mode}`);
	if (info.round) {
		const r = info.round;
		parts.push(`round=${r.roundID} book=${r.bookID} x${r.payoutMultiplier} active=${r.active}${r.bonus ? ' bonus' : ''}`);
		if (r.event != null) parts.push(`event=${r.event}`);
	}
	if (info.forced) parts.push('forced');
	if (info.event !== undefined) parts.push(`event=${info.event}`);
	if (info.payout !== undefined) parts.push(`payout=${info.payout}`);
	if (info.balance !== undefined) parts.push(`balance=${info.balance}`);
	if (info.bookID !== undefined) parts.push(`book=${info.bookID}`);
	if (info.warning) parts.push(`WARN ${info.warning}`);
	if (info.error) parts.push(`${info.error}: ${info.message}`);
	return parts.join(' ');
};

async function handler(req, res) {
	const tStart = Date.now();
	const url = new URL(req.url, 'https://localhost');
	const { pathname } = url;
	const routeKey = `${req.method} ${pathname}`;
	const isRgs = Object.hasOwn(rgs, routeKey) || pathname.startsWith('/bet/replay/') || pathname.startsWith('/wallet/') || pathname.startsWith('/bet/');
	const isAdmin = pathname.startsWith('/__admin/');

	if (req.method === 'OPTIONS') {
		res.writeHead(204, CORS).end();
		return;
	}

	if (!isRgs && !isAdmin) {
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			res.writeHead(405).end();
			return;
		}
		const status = serveStatic(req, res, pathname);
		if (!CONFIG.quietStatic) say(`${req.method} ${pathname} ${status}`);
		return;
	}

	const entry = { seq: ++seq, tStart: tStart - T0, method: req.method, path: pathname, kind: isAdmin ? 'admin' : 'rgs' };
	const info = {};
	let status = 200;
	let out;
	let sid;
	let inflightCounted = false;
	try {
		const raw = req.method === 'POST' ? await readBody(req) : '';
		let body = {};
		if (raw) {
			try {
				body = JSON.parse(raw);
			} catch {
				fail(400, 'ERR_VAL', 'invalid JSON body');
			}
		}
		sid = body?.sessionID;
		if (routeKey === 'POST /wallet/play' && typeof sid === 'string') {
			const n = (playInFlight.get(sid) ?? 0) + 1;
			playInFlight.set(sid, n);
			inflightCounted = true;
			entry.inFlightAtStart = n;
			if (n > 1) addViolation('concurrentPlay', sid, `${n} /wallet/play requests in flight`);
		}
		if (isAdmin) out = admin(req.method, pathname, url.searchParams, body);
		else if (Object.hasOwn(rgs, routeKey)) out = rgs[routeKey](body, info);
		else if (req.method === 'GET' && pathname.startsWith('/bet/replay/')) {
			const parts = pathname.slice('/bet/replay/'.length).split('/');
			if (parts.length !== 4) fail(404, 'ERR_VAL', 'expected /bet/replay/{game}/{version}/{mode}/{event}');
			out = replay(parts, info);
		} else fail(404, 'ERR_VAL', `unknown endpoint ${routeKey}`);
	} catch (err) {
		if (err instanceof RgsError) {
			status = err.status;
			out = { error: err.code, message: err.message };
		} else {
			status = 500;
			out = { error: 'ERR_GEN', message: String(err?.stack ?? err) };
		}
		info.error = out.error;
		info.message = out.message;
	}
	if (!isAdmin && CONFIG.latency > 0) await sleep(CONFIG.latency);
	sendJson(res, status, out);
	if (inflightCounted) playInFlight.set(sid, playInFlight.get(sid) - 1);

	Object.assign(entry, { tEnd: Date.now() - T0, status, sessionID: info.sessionID ?? sid ?? null, ...info });
	if (!isAdmin) {
		log.push(entry);
		if (log.length > 20000) log.splice(0, log.length - 20000);
		say(`${req.method} ${pathname} ${status} ${entry.tEnd - entry.tStart}ms ${fmtInfo({ ...info, sessionID: entry.sessionID })}`);
	} else if (req.method !== 'GET') {
		say(`${req.method} ${pathname} ${status} ${JSON.stringify(out).slice(0, 200)}`);
	}
}

// ---------------------------------------------------------------- TLS + listen

function tlsMaterial() {
	if (args.cert && args.key) {
		return { cert: fs.readFileSync(args.cert), key: fs.readFileSync(args.key), dir: null };
	}
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-rgs-'));
	const key = path.join(dir, 'key.pem');
	const cert = path.join(dir, 'cert.pem');
	const base = ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes',
		'-keyout', key, '-out', cert, '-days', '7', '-subj', '/CN=localhost'];
	try {
		execFileSync('openssl', [...base, '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0:0:0:0:0:0:0:1'], { stdio: 'pipe' });
	} catch {
		execFileSync('openssl', base, { stdio: 'pipe' });
	}
	return { cert: fs.readFileSync(cert), key: fs.readFileSync(key), dir };
}

const tls = tlsMaterial();
const servers = [];
const listen = (host, port) =>
	new Promise((resolve, reject) => {
		const srv = https.createServer({ cert: tls.cert, key: tls.key }, (req, res) =>
			handler(req, res).catch((err) => {
				say(`handler crash: ${err?.stack ?? err}`);
				if (!res.headersSent) sendJson(res, 500, { error: 'ERR_GEN', message: String(err) });
			}),
		);
		srv.keepAliveTimeout = 5000;
		srv.once('error', reject);
		srv.listen(port, host, () => {
			servers.push(srv);
			resolve(srv.address().port);
		});
	});

function shutdown() {
	for (const s of servers) s.close();
	if (tls.dir) fs.rmSync(tls.dir, { recursive: true, force: true });
	process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

let port;
if (CONFIG.host) {
	port = await listen(CONFIG.host, CONFIG.port);
} else {
	port = await listen('127.0.0.1', CONFIG.port);
	try {
		await listen('::1', port);
	} catch (err) {
		say(`(::1 not bound: ${err.code ?? err.message})`);
	}
}

const gameUrl = `https://localhost:${port}/index.html?sessionID=dev-session&rgs_url=localhost:${port}&lang=en&currency=${CONFIG.currency}&device=desktop`;
say(`static  ${CONFIG.staticDir}${fs.existsSync(CONFIG.staticDir) ? '' : '  (MISSING!)'}`);
say(`library ${CONFIG.libraryDir} modes=${[...MODES.keys()].join(',')}`);
say(`seed=${CONFIG.seed} forced=[${forced.join(',')}] latency=${CONFIG.latency}ms jurisdiction=${JSON.stringify(CONFIG.config.jurisdiction)}`);
say(`listening on https://localhost:${port}  (self-signed cert; accept it once in the browser)`);
say(`open: ${gameUrl}`);
process.stdout.write(`MOCK_RGS_READY ${JSON.stringify({ port, pid: process.pid, seed: CONFIG.seed, staticDir: CONFIG.staticDir })}\n`);

if (bool('preload')) {
	setImmediate(() => {
		for (const m of MODES.values()) m.load();
		process.stdout.write(`MOCK_RGS_BOOKS_LOADED\n`);
	});
}
