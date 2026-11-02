<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';

	import { Container, Rectangle, Sprite, Text } from 'pixi-svelte';
	import { stateUi } from 'state-shared';

	import { getContext } from '../game/context';
	import { gameLayout } from '../game/stateLayout';
	import { ART_GEOMETRY } from '../game/artAssets';
	import { runLoop, wait, between } from '../motion/loop';
	import { textStyle } from '../game/theme';

	// Sunburst crest and logo plaque on the frame's top edge. A slow light sweep crosses the plaque
	// every ~20 s. In free spins the plaque shows the spin counter instead of the name.
	const context = getContext();
	const { w, h } = ART_GEOMETRY.sizes.logo;
	const slot = $derived(gameLayout().logo);
	// plaque rectangle in crest units, relative to the image centre
	const plaque = { x: -232, y: 30, w: 464, h: 70 };
	const sweep = new Tween(-1, { easing: cubicInOut });
	const showCounter = $derived(context.stateGame.gameType === 'freegame' && stateUi.freeSpinCounterTotal > 0);

	onMount(() =>
		runLoop(async (alive) => {
			await wait(between(14000, 22000));
			if (!alive()) return;
			await sweep.set(-1, { duration: 0 });
			await sweep.set(1, { duration: 1600 });
		}),
	);
</script>

<Container x={slot.x} y={slot.y} scale={slot.scale}>
	<Sprite key={showCounter ? 'logo_blank' : 'logo'} anchor={0.5} width={w} height={h} />
	{#if showCounter}
		<Text anchor={0.5} y={plaque.y + 22} text="FREE SPINS" style={textStyle.caption(13)} />
		<Text
			anchor={0.5}
			y={plaque.y + 49}
			text={`${stateUi.freeSpinCounterCurrent || 0} OF ${stateUi.freeSpinCounterTotal}`}
			style={textStyle.value(28)}
		/>
	{/if}
	<Container>
		<Rectangle isMask x={plaque.x} y={plaque.y} width={plaque.w} height={plaque.h} />
		<Sprite
			key="fx_sweep"
			anchor={0.5}
			x={sweep.current * 360}
			y={plaque.y + plaque.h / 2}
			width={300}
			height={plaque.h * 1.3}
			alpha={Math.abs(sweep.current) < 1 ? 0.55 : 0}
			blendMode="add"
		/>
	</Container>
</Container>
