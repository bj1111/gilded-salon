<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { Container, Sprite } from 'pixi-svelte';

	import type { Cell } from '../presentation/paylines';
	import { getSymbolX, getSymbolY } from '../game/utils';

	// One winning payline as a glowing gold beam through the cells it pays on, drawn on progressively
	// (board units; lives inside the board container).
	type Props = { cells: Cell[]; delay?: number };

	const props: Props = $props();
	const progress = new Tween(0, { duration: 360, easing: cubicOut });
	const points = $derived(props.cells.map((cell) => ({ x: getSymbolX(cell.reel), y: getSymbolY(cell.row) })));
	const segments = $derived(
		points.slice(1).map((to, i) => {
			const from = points[i];
			const dx = to.x - from.x;
			const dy = to.y - from.y;
			return { from, length: Math.hypot(dx, dy), rotation: Math.atan2(dy, dx) };
		}),
	);

	onMount(() => {
		const timer = setTimeout(() => (progress.target = 1), props.delay ?? 0);
		return () => clearTimeout(timer);
	});

	// how much of segment i is drawn at the current progress
	const drawn = (i: number) => Math.max(0, Math.min(1, progress.current * segments.length - i));
</script>

<Container>
	{#each segments as segment, i (i)}
		{#if drawn(i) > 0}
			<Sprite
				key="fx_beam"
				anchor={{ x: 0, y: 0.5 }}
				x={segment.from.x}
				y={segment.from.y}
				width={segment.length * drawn(i)}
				height={26}
				rotation={segment.rotation}
				blendMode="add"
			/>
		{/if}
	{/each}
	{#each points as point, i (i)}
		{#if i === 0 || drawn(i - 1) >= 1}
			<Sprite key="fx_dot" anchor={0.5} x={point.x} y={point.y} width={34} height={34} blendMode="add" />
		{/if}
	{/each}
</Container>
