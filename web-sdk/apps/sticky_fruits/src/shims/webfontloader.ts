// Stand-in for the 'webfontloader' package. The SDK's pixi-svelte preloads an Adobe Typekit kit
// through it on start-up; Stake Engine builds may not fetch anything from external hosts, so the
// alias in vite.config.js points the import here and our own bundled fonts are used instead
// (see src/game/fonts.ts and the @font-face rules in app.html).
type WebFontConfig = { active?: () => void };

export default {
	load(config: WebFontConfig) {
		config?.active?.();
	},
};
