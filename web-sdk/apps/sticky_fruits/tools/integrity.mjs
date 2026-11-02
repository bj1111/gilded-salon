// Runs the TEST/integrity Storybook story (Storybook must be running on :6002) and reports whether
// every played book ended with the reels showing the book's final board and WIN = finalWin.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errors.push(m.text()));
// --from N continues an interrupted run at book N
const fromArg = process.argv.indexOf('--from');
const from = fromArg > 0 ? Number(process.argv[fromArg + 1]) : 0;
if (from) console.log(`starting at book ${from}`);
await page.goto(`http://localhost:6002/iframe.html?id=test-integrity--books&viewMode=story&from=${from}`, { waitUntil: 'load' });
await page.waitForTimeout(7000);
await page.getByText('Action').first().click();
const started = Date.now();
let state = { done: false };
// a round that makes no progress for 2 minutes is captured (INTEGRITY_SHOTS dir, default tmp)
const shots = process.env.INTEGRITY_SHOTS ?? (await import('node:os')).tmpdir();
let lastPlayed = -1;
let lastChange = Date.now();
while (!state.done && Date.now() - started < 90 * 60 * 1000) {
	await page.waitForTimeout(1500);
	// tap through panels that wait for the player (free-spin intro / outro)
	await page.mouse.click(640, 400);
	state = JSON.parse(await page.locator('#integrity').innerText());
	if (state.played !== lastPlayed) {
		lastPlayed = state.played;
		lastChange = Date.now();
	} else if (Date.now() - lastChange > 120_000) {
		const file = `${shots}/integrity-stall-${state.played}-${Date.now()}.png`;
		await page.screenshot({ path: file });
		console.log(`\nno progress on round ${state.played} for 2 min: ${file}; errors so far: ${JSON.stringify([...new Set(errors)].slice(0, 5))}`);
		lastChange = Date.now();
	}
	process.stdout.write(`\rplayed ${state.played}/${state.total} failed ${state.failed?.length ?? 0}   `);
}
console.log('\n' + JSON.stringify({ ...state, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await browser.close();
process.exit(state.done && state.failed.length === 0 && errors.length === 0 ? 0 : 1);
