/**
 * Gilded Salon audio — original sound, synthesized at runtime with WebAudio (no audio files shipped).
 *
 *   import { audio } from '../audio';
 *   await audio.unlock();                 // from the first user gesture
 *   audio.music('base');
 *   audio.play('reelStop', { index: 2 });
 *   audio.loop('anticipation'); audio.stop('anticipation');
 *   audio.setVolume(soundOn ? 1 : 0);
 *
 * A licensed file in `src/audio/override/<name>.<mp3|ogg|m4a|wav>` (or `music_base.*`,
 * `music_private.*`) replaces the matching synth voice.
 */
import { AudioEngine, type AudioApi } from './engine';

export type { AudioApi, EngineOptions, Graph } from './engine';
export { AudioEngine, buildGraph, createAudioEngine } from './engine';
export type { LoopName, MusicTrack, PlayOptions, SfxName } from './soundMap';
export { LOOP_NAMES, SFX_NAMES, gainForVolume, keyPitch, tickPitch } from './soundMap';
export { overrideUrlFor } from './overrides';

const engine = new AudioEngine();

/** The game's audio singleton (methods are pre-bound; safe to pass around as callbacks). */
export const audio: AudioApi = {
	unlock: () => engine.unlock(),
	play: (name, opts) => engine.play(name, opts),
	loop: (name) => engine.loop(name),
	stop: (name) => engine.stop(name),
	music: (track) => engine.music(track),
	setVolume: (v) => engine.setVolume(v),
	setBusVolumes: (levels) => engine.setBusVolumes(levels),
	suspend: () => engine.suspend(),
	resume: () => engine.resume(),
};
