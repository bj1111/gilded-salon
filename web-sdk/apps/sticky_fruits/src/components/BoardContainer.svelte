<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Container } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		children: Snippet;
	};

	const props: Props = $props();

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
</script>

<!-- children draw in board units: (0,0) is the top-left of the reels, one cell is SYMBOL_SIZE -->
<Container x={layout.x} y={layout.y} scale={layout.scale} pivot={layout.pivot}>
	{@render props.children()}
</Container>
