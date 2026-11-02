// Idle animations (twinkles, glints, light sweeps) are async loops started in onMount;
// the returned stop() goes in the cleanup so nothing keeps running after unmount.

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const runLoop = (step: (alive: () => boolean) => Promise<void>) => {
	let alive = true;
	const isAlive = () => alive;
	(async () => {
		while (alive) {
			const started = Date.now();
			await step(isAlive);
			// a step that finished without waiting must still yield to timers and rendering,
			// otherwise the loop spins on microtasks and freezes the page
			if (Date.now() - started < 4) await wait(16);
		}
	})();
	return () => {
		alive = false;
	};
};

// random number in [min, max)
export const between = (min: number, max: number) => min + Math.random() * (max - min);
