<script lang="ts">
	import { onMount } from 'svelte';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { App } from 'pixi-svelte';
	import { stateModal } from 'state-shared';

	import { GameVersion } from 'components-ui-html';

	import { getContext } from '../game/context';
	import EnableSound from './EnableSound.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Sound from './Sound.svelte';
	import Background from './Background.svelte';
	import BoardFrame from './BoardFrame.svelte';
	import Board from './Board.svelte';
	import Anticipations from './Anticipations.svelte';
	import Win from './Win.svelte';
	import FreeSpinIntro from './FreeSpinIntro.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import Curtains from './Curtains.svelte';
	import ChipCounter from './ChipCounter.svelte';
	import RetriggerBanner from './RetriggerBanner.svelte';
	import ParticleLayer from '../fx/ParticleLayer.svelte';
	import Hud from '../ui/Hud.svelte';
	import GameModals from '../ui/modals/GameModals.svelte';
	import { installE2eProbe } from '../game/e2eProbe';

	const context = getContext();
	installE2eProbe();

	onMount(() => (context.stateLayout.showLoadingScreen = true));

	context.eventEmitter.subscribeOnMount({
		buyBonusConfirm: () => {
			stateModal.modal = { name: 'buyBonusConfirm' };
		},
	});
</script>

<App>
	<EnableSound />
	<EnableHotkey />
	<EnableGameActor />
	<EnablePixiExtension />

	{#if context.stateApp.loaded}
		<Background />
	{/if}

	<!-- the HTML loader (HtmlLoader.svelte) covers the canvas until the player taps to enter -->
	{#if !context.stateLayout.showLoadingScreen && context.stateApp.loaded}
		<ResumeBet />
		<!--
			The reason why <Sound /> is rendered after clicking the loading screen:
			"Autoplay with sound is allowed if: The user has interacted with the domain (click, tap, etc.)."
			Ref: https://developer.chrome.com/blog/autoplay
		-->
		<Sound />

		<Curtains />
		<BoardFrame />
		<Board />
		<Anticipations />

		<Hud />
		<ChipCounter />
		<RetriggerBanner />
		<Win />
		<FreeSpinIntro />
		<FreeSpinOutro />
		<ParticleLayer />
	{/if}
</App>

<GameModals>
	{#snippet version()}
		<GameVersion version="1.0.0" />
	{/snippet}
</GameModals>
