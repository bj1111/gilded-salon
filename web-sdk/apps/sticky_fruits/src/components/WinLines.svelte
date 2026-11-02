<script lang="ts" module>
	import type { Cell } from '../presentation/paylines';

	export type EmitterEventWinLines =
		| { type: 'winLinesShow'; lines: Cell[][]; cells: Cell[] }
		| { type: 'winLinesHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { Container, Rectangle } from 'pixi-svelte';

	import LineTrace from '../fx/LineTrace.svelte';
	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS, SYMBOL_SIZE } from '../game/constants';
	import { COLOR } from '../game/theme';

	// While a win is shown: every cell that does not pay is dimmed and each paying line is traced
	// in gold through the cells it pays on (board units, between the reels and the win layer).
	const context = getContext();
	let lines = $state<Cell[][]>([]);
	let paying = $state<Set<string>>(new Set());
	let round = $state(0);
	const dim = new Tween(0, { duration: 220, easing: cubicOut });

	context.eventEmitter.subscribeOnMount({
		winLinesShow: (event) => {
			lines = event.lines;
			paying = new Set(event.cells.map((cell) => `${cell.reel}-${cell.row}`));
			round += 1;
			dim.target = 1;
		},
		winLinesHide: () => {
			dim.target = 0;
			lines = [];
		},
	});

	const cells = Array.from({ length: BOARD_DIMENSIONS.x * BOARD_DIMENSIONS.y }, (_, i) => ({
		reel: Math.floor(i / BOARD_DIMENSIONS.y),
		row: i % BOARD_DIMENSIONS.y,
	}));
</script>

{#if dim.current > 0.01}
	<Container alpha={dim.current}>
		{#each cells as cell (cell.reel * 10 + cell.row)}
			{#if !paying.has(`${cell.reel}-${cell.row}`)}
				<Rectangle
					x={cell.reel * SYMBOL_SIZE + 2}
					y={cell.row * SYMBOL_SIZE + 2}
					width={SYMBOL_SIZE - 4}
					height={SYMBOL_SIZE - 4}
					backgroundColor={COLOR.lacquer}
					backgroundAlpha={0.62}
				/>
			{/if}
		{/each}
	</Container>
{/if}

{#key round}
	{#each lines as line, i (i)}
		<LineTrace cells={line} delay={i * 90} />
	{/each}
{/key}
