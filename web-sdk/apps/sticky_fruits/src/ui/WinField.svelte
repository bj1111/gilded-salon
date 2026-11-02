<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { Container, Sprite, Text } from 'pixi-svelte';
	import { stateBet } from 'state-shared';

	import type { Slot } from './layout';
	import { bookMoney } from '../game/money';
	import { COLOR, textStyle } from '../game/theme';

	// The WIN plaque under the reels. It follows the round total from the book (setTotalWin),
	// rolling up rather than jumping, and turns gold while there is a win to show.
	type Props = { at: Slot; caption: string; sizes: { value: number; caption: number } };

	const props: Props = $props();
	const amount = new Tween(stateBet.winBookEventAmount, { duration: 500, easing: cubicOut });
	const PLAQUE = { w: 320, h: 80 };

	$effect(() => {
		// counting down to zero at the start of a round should be instant
		const target = stateBet.winBookEventAmount;
		amount.set(target, { duration: target === 0 ? 0 : 500 });
	});

	const sx = $derived(props.at.w / props.at.scale / PLAQUE.w);
	const sy = $derived(props.at.h / props.at.scale / PLAQUE.h);
	const value = $derived(bookMoney(amount.current, stateBet.winBookEventAmount));
</script>

<Container x={props.at.x} y={props.at.y} scale={props.at.scale}>
	<Sprite key="plaque" anchor={0.5} width={PLAQUE.w * sx} height={PLAQUE.h * sy} />
	<Text anchor={{ x: 0.5, y: 0.5 }} y={-PLAQUE.h * sy * 0.2} text={props.caption} style={textStyle.caption(props.sizes.caption * 0.85)} />
	<Text
		anchor={{ x: 0.5, y: 0.5 }}
		y={PLAQUE.h * sy * 0.16}
		text={value}
		style={textStyle.value(props.sizes.value * 0.9, stateBet.winBookEventAmount > 0 ? { fill: COLOR.gold } : {})}
	/>
</Container>
