import { describe, expect, it } from 'vitest';

import { OVERRIDE_FILES, musicOverrideKey, overrideUrlFor } from './overrides';

describe('overrideUrlFor', () => {
	const files: Record<string, string> = {
		'./override/reelStop.mp3': '/assets/reelStop-a1.mp3',
		'./override/winSmall.wav': '/assets/winSmall-b2.wav',
		'./override/winSmall.mp3': '/assets/winSmall-c3.mp3',
		'./override/tierBigger.ogg': '/assets/tierBigger.ogg',
		'./override/music_base.m4a': '/assets/music_base.m4a',
		'./override/notes.txt': '/assets/notes.txt',
	};

	it('returns the url of a matching override file', () => {
		expect(overrideUrlFor('reelStop', files)).toBe('/assets/reelStop-a1.mp3');
	});

	it('returns undefined when there is no override', () => {
		expect(overrideUrlFor('uiClick', files)).toBeUndefined();
		expect(overrideUrlFor('uiClick', {})).toBeUndefined();
	});

	it('matches the whole file stem, not a prefix', () => {
		expect(overrideUrlFor('tierBig', files)).toBeUndefined();
	});

	it('prefers the most compatible format when several exist', () => {
		expect(overrideUrlFor('winSmall', files)).toBe('/assets/winSmall-c3.mp3');
	});

	it('ignores non-audio files', () => {
		expect(overrideUrlFor('notes' as never, files)).toBeUndefined();
	});

	it('resolves music overrides', () => {
		expect(musicOverrideKey('base')).toBe('music_base');
		expect(musicOverrideKey('private')).toBe('music_private');
		expect(overrideUrlFor(musicOverrideKey('base'), files)).toBe('/assets/music_base.m4a');
		expect(overrideUrlFor(musicOverrideKey('private'), files)).toBeUndefined();
	});
});

describe('OVERRIDE_FILES', () => {
	it('loads (empty override folder) without crashing', () => {
		expect(typeof OVERRIDE_FILES).toBe('object');
		expect(Object.keys(OVERRIDE_FILES).every((k) => /\.(mp3|ogg|m4a|wav)$/.test(k))).toBe(true);
	});
});
