// @ts-ignore
import config from 'config-vite';
import { fileURLToPath } from 'node:url';

const base = config();

// The SDK's shared state ships sample bet-mode artwork hosted on third-party URLs. This game never
// shows those (it has no buy modes), but Stake Engine builds should reference no external hosts,
// so the URLs are blanked out of the bundle at build time.
const SAMPLE_URL = /https:\/\/(?:staging-1-0\.twist-game\.app|test-fart-cdn-bucket\.s3\.[a-z0-9-]+\.amazonaws\.com)[^'"`\s]*/g;
const stripSdkSampleUrls = {
	name: 'strip-sdk-sample-urls',
	enforce: 'pre',
	transform(code, id) {
		if (!id.includes('state-shared') || !SAMPLE_URL.test(code)) return null;
		SAMPLE_URL.lastIndex = 0;
		return { code: code.replace(SAMPLE_URL, ''), map: null };
	},
};

export default {
	...base,
	plugins: [stripSdkSampleUrls, ...(base.plugins ?? [])],
	resolve: {
		...base.resolve,
		alias: {
			...base.resolve?.alias,
			// keep the SDK's Typekit preload from reaching the network (see src/shims/webfontloader.ts)
			webfontloader: fileURLToPath(new URL('./src/shims/webfontloader.ts', import.meta.url)),
		},
	},
};
