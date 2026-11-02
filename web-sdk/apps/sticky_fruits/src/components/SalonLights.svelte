<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { sineInOut } from 'svelte/easing';

	import { Container, Sprite } from 'pixi-svelte';

	import { runLoop, wait, between } from '../motion/loop';

	// Keeps the room quietly alive: a few harbour lights twinkle and one chandelier crystal
	// catches the light now and then. Positions come from the background art (art units).
	type Props = {
		lights: readonly (readonly number[])[];
		glints: readonly (readonly number[])[];
		dimmed: boolean;
	};

	const props: Props = $props();
	const TWINKLERS = 6;
	const twinkle = Array.from({ length: TWINKLERS }, () => new Tween(0.2, { easing: sineInOut }));
	const picks = $derived(
		Array.from({ length: TWINKLERS }, (_, i) => props.lights[(i * 5 + 3) % Math.max(1, props.lights.length)]),
	);
	const glint = new Tween(0, { easing: sineInOut });
	let glintAt = $state(0);

	onMount(() => {
		const stops = twinkle.map((tween) =>
			runLoop(async (alive) => {
				await tween.set(between(0.55, 0.95), { duration: between(900, 1800) });
				if (!alive()) return;
				await tween.set(between(0.08, 0.3), { duration: between(1200, 2600) });
			}),
		);
		stops.push(
			runLoop(async (alive) => {
				await wait(between(2500, 6000));
				if (!alive() || props.glints.length === 0) return;
				glintAt = Math.floor(Math.random() * props.glints.length);
				await glint.set(1, { duration: 260 });
				await glint.set(0, { duration: 700 });
			}),
		);
		return () => stops.forEach((stop) => stop());
	});
</script>

<Container alpha={props.dimmed ? 0.25 : 1}>
	{#each picks as light, i (i)}
		{#if light}
			<Sprite key="fx_dot" anchor={0.5} x={light[0]} y={light[1]} width={22} height={22} alpha={twinkle[i].current} blendMode="add" />
		{/if}
	{/each}
	{#if props.glints[glintAt]}
		<Sprite
			key="fx_glint"
			anchor={0.5}
			x={props.glints[glintAt][0]}
			y={props.glints[glintAt][1]}
			width={46}
			height={46}
			alpha={glint.current}
			rotation={glint.current * 0.6}
			blendMode="add"
		/>
	{/if}
</Container>
