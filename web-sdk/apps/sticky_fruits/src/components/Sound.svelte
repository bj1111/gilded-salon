<script lang="ts" module>
	import type { LoopName, MusicTrack, SfxName } from '../audio';

	export type EmitterEventSound =
		| { type: 'sfx'; name: SfxName; index?: number }
		| { type: 'sfxLoop'; name: LoopName }
		| { type: 'sfxStop'; name: SfxName }
		| { type: 'music'; track: MusicTrack };
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	import { audio } from '../audio';
	import { getContext } from '../game/context';

	// Routes game events to the synthesized audio engine (src/audio). Mounted after the player's
	// first tap, so the AudioContext may start.
	const context = getContext();

	context.eventEmitter.subscribeOnMount({
		// SDK HUD/modals
		soundPressGeneral: () => audio.play('uiClick'),
		soundPressBet: () => audio.play('spinPress'),
		// game
		sfx: ({ name, index }) => audio.play(name, { index }),
		sfxLoop: ({ name }) => audio.loop(name),
		sfxStop: ({ name }) => audio.stop(name),
		music: ({ track }) => audio.music(track),
	});

	onMount(() => {
		audio.unlock();
		audio.music(context.stateGame.gameType === 'freegame' ? 'private' : 'base');
		return () => audio.music(null);
	});
</script>
