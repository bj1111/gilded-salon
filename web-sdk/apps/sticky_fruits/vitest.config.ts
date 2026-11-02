import { defineConfig } from 'vitest/config';

// Unit tests for the pure presentation/audio/layout logic. Svelte components are verified
// through Storybook captures (see tools/), not here.
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
	},
});
