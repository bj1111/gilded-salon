<script lang="ts">
	import { stateSound, stateSoundDerived } from 'state-shared';

	import { audio } from '../audio';

	// Volumes follow the SDK sound settings: master (0 = sound off silences everything), and the
	// music and effects sliders under it.
	$effect(() => {
		audio.setVolume(stateSoundDerived.volumeMaster());
	});
	$effect(() => {
		audio.setBusVolumes({
			music: stateSound.volumeValueMusic / 100,
			sfx: stateSound.volumeValueSoundEffect / 100,
		});
	});
</script>
