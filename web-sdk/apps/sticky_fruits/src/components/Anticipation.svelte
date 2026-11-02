<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { sineInOut } from 'svelte/easing';

	import { Container, Rectangle, Sprite } from 'pixi-svelte';

	import type { Reel } from '../game/stateGame.svelte';
	import { BOARD_SIZES, SYMBOL_SIZE } from '../game/constants';
	import { getSymbolX } from '../game/utils';
	import { COLOR } from '../game/theme';
	import { runLoop } from '../motion/loop';

	// Rouge outline on a reel the math has flagged for anticipation (a free-spin trigger is still
	// possible). Drawn in board units inside the board container.
	type Props = {
		reel: Reel;
		oncomplete: () => void;
	};

	const props: Props = $props();
	const alpha = new Tween(0, { easing: sineInOut });
	let stopping = false;
	let stopPulse = () => {};

	onMount(() => {
		stopPulse = runLoop(async (alive) => {
			await alpha.set(1, { duration: 320 });
			if (!alive() || stopping) return;
			await alpha.set(0.5, { duration: 320 });
		});
		return () => stopPulse();
	});

	$effect(() => {
		if (props.reel.reelState.motion === 'stopped' && !stopping) {
			stopping = true;
			stopPulse();
			alpha.set(0, { duration: 220 }).then(() => props.oncomplete());
		}
	});
</script>

<Container x={getSymbolX(props.reel.reelIndex)} y={BOARD_SIZES.height / 2} alpha={alpha.current}>
	<Sprite key="fx_rouge" anchor={0.5} width={SYMBOL_SIZE * 1.9} height={BOARD_SIZES.height * 1.25} blendMode="add" />
	<Rectangle
		anchor={0.5}
		width={SYMBOL_SIZE - 6}
		height={BOARD_SIZES.height - 6}
		borderRadius={10}
		backgroundColor={COLOR.rouge}
		backgroundAlpha={0.08}
		borderColor={COLOR.rouge}
		borderWidth={4}
	/>
</Container>
