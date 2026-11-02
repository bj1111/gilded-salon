<script lang="ts">
	import { OnMount } from 'components-shared';

	import { getContext } from '../game/context';
	import Anticipation from './Anticipation.svelte';
	import BoardContainer from './BoardContainer.svelte';

	const context = getContext();
	const hasAnticipation = $derived(
		context.stateGame.board.some((reel) => reel.reelState.anticipating),
	);
</script>

{#if hasAnticipation}
	<OnMount
		onmount={() => {
			context.eventEmitter.broadcast({ type: 'sfxLoop', name: 'anticipation' });
			return () => context.eventEmitter.broadcast({ type: 'sfxStop', name: 'anticipation' });
		}}
	/>
{/if}

<BoardContainer>
	{#each context.stateGame.board as reel}
		{#if reel.reelState.anticipating}
			<Anticipation {reel} oncomplete={() => (reel.reelState.anticipating = false)} />
		{/if}
	{/each}
</BoardContainer>
