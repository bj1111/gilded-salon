<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';

	import type { Layout } from './layout';
	import { COLOR } from '../game/theme';

	// The lacquer table rail the controls sit on (bottom rail, or a side column in landscape).
	type Props = { layout: Layout; canvasWidth: number };

	const props: Props = $props();
</script>

{#if props.layout.rail}
	<Sprite key="rail" x={0} y={props.layout.rail.y} width={props.canvasWidth} height={props.layout.rail.height} />
{/if}
{#if props.layout.column}
	{@const column = props.layout.column}
	<Rectangle x={column.x} y={column.y} width={column.w} height={column.h} backgroundColor={COLOR.lacquer} backgroundAlpha={0.82} />
	<Rectangle x={column.x} y={column.y} width={Math.max(2, 3 * props.layout.u)} height={column.h} backgroundColor={COLOR.goldMid} />
{/if}
