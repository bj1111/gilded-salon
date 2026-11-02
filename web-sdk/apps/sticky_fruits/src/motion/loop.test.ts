import { describe, expect, it } from 'vitest';

import { runLoop, wait } from './loop';

describe('runLoop', () => {
	it('repeats the step until stopped', async () => {
		let runs = 0;
		const stop = runLoop(async () => {
			runs += 1;
			await wait(5);
		});
		await wait(32);
		stop();
		const afterStop = runs;
		await wait(20);
		expect(afterStop).toBeGreaterThanOrEqual(3);
		expect(runs).toBeLessThanOrEqual(afterStop + 1);
	});

	it('lets a step see that the loop was stopped', async () => {
		let sawStop = false;
		const stop = runLoop(async (alive) => {
			await wait(10);
			if (!alive()) sawStop = true;
		});
		await wait(2);
		stop();
		await wait(15);
		expect(sawStop).toBe(true);
	});

	it('never starves timers when a step returns without waiting', async () => {
		let timerFired = false;
		setTimeout(() => (timerFired = true), 5);
		const stop = runLoop(async () => {
			// returns at once (e.g. "nothing to animate right now")
		});
		await wait(30);
		stop();
		expect(timerFired).toBe(true);
	});
});
