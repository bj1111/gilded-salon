<script lang="ts">
	import { Container, Text } from 'pixi-svelte';

	import type { Slot } from './layout';
	import { COLOR, textStyle } from '../game/theme';

	// Gold spaced caption over an ivory value (BALANCE / BET). Long values shrink to fit the slot.
	type Props = {
		at: Slot;
		caption: string;
		value: string;
		sizes: { value: number; caption: number };
		gold?: boolean;
	};

	const props: Props = $props();
	const widthUnits = $derived(props.at.w / props.at.scale);
	// Josefin Sans digits average ~0.56 em
	const fit = $derived(Math.min(1, widthUnits / Math.max(1, props.value.length * props.sizes.value * 0.56)));
</script>

<Container x={props.at.x} y={props.at.y} scale={props.at.scale}>
	<Text anchor={{ x: 0.5, y: 1 }} y={-4} text={props.caption} style={textStyle.caption(props.sizes.caption)} />
	<Text
		anchor={{ x: 0.5, y: 0 }}
		y={2}
		scale={fit}
		text={props.value}
		style={textStyle.value(props.sizes.value, props.gold ? { fill: COLOR.gold } : {})}
	/>
</Container>
