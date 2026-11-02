<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	import { Container, Sprite, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { ART_GEOMETRY } from '../game/artAssets';
	import { textStyle } from '../game/theme';

	// Art-deco lacquer card centred on the reels (free-spin intro/outro). Children draw in panel
	// units: (0,0) is the card centre, the card is 640 x 420.
	type Props = { footer?: string; children: Snippet };

	const props: Props = $props();
	const context = getContext();
	const PANEL = ART_GEOMETRY.sizes.panel;
	const pop = new Tween(0.85, { duration: 420, easing: backOut });
	const board = $derived(context.stateGameDerived.boardLayout());
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const scale = $derived(
		Math.min((board.width * board.scale * 1.02) / PANEL.w, (canvas.width * 0.94) / PANEL.w, (canvas.height * 0.8) / PANEL.h),
	);

	onMount(() => {
		pop.target = 1;
	});
</script>

<Container x={board.x} y={board.y} scale={scale * pop.current}>
	<Sprite key="panel" anchor={0.5} width={PANEL.w} height={PANEL.h} />
	{@render props.children()}
	{#if props.footer}
		<Text anchor={0.5} y={PANEL.h / 2 - 46} text={props.footer} style={textStyle.caption(15)} />
	{/if}
</Container>
