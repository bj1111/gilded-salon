/**
 * Licensed-audio overrides. Drop a file named after a sound into `src/audio/override/`
 * (e.g. `override/reelStop.mp3`, `override/music_base.ogg`) and it replaces the synth voice.
 * Vite resolves the folder at build time; with no files the map is empty and the synth plays.
 */
import type { MusicTrackName, SfxName } from './soundMap';

export type OverrideKey = SfxName | `music_${MusicTrackName}`;

/** Most widely decodable first (Safari cannot always decode Ogg). */
const FORMAT_PREFERENCE = ['mp3', 'm4a', 'ogg', 'wav'] as const;

function loadOverrideFiles(): Record<string, string> {
	try {
		// Vite/vitest rewrite this call at build time. Anything else (esbuild bundles for the
		// offline audio check, plain node) leaves `import.meta.glob` undefined → TypeError → no overrides.
		return import.meta.glob('./override/*.{mp3,ogg,m4a,wav}', {
			eager: true,
			query: '?url',
			import: 'default',
		}) as Record<string, string>;
	} catch {
		return {};
	}
}

/** Glob path (`./override/<key>.<ext>`) → served URL. */
export const OVERRIDE_FILES: Record<string, string> = loadOverrideFiles();

export const musicOverrideKey = (track: MusicTrackName): OverrideKey => `music_${track}`;

/** URL of the override file for `name`, if one exists (whole-stem match, best format wins). */
export function overrideUrlFor(name: OverrideKey, files: Record<string, string>): string | undefined {
	let best: { rank: number; url: string } | undefined;
	for (const [path, url] of Object.entries(files)) {
		const file = path.slice(path.lastIndexOf('/') + 1);
		const dot = file.lastIndexOf('.');
		if (dot <= 0 || file.slice(0, dot) !== name) continue;
		const rank = FORMAT_PREFERENCE.indexOf(file.slice(dot + 1).toLowerCase() as never);
		if (rank < 0) continue;
		if (!best || rank < best.rank) best = { rank, url };
	}
	return best?.url;
}
