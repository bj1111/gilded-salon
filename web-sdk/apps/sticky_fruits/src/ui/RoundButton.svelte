<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { Button } from 'components-pixi';

	import type { Slot } from './layout';
	import { textStyle } from '../game/theme';

	// Brass HUD button: gold ring, lacquer face, ivory glyph. `active` lights a gold ring around it
	// (turbo on, autoplay running); `badge` shows a small count (autoplay spins left).
	type Props = {
		at: Slot;
		icon: string;
		onpress: () => void;
		disabled?: boolean;
		active?: boolean;
		badge?: string;
	};

	const props: Props = $props();
	const D = 128;
</script>

<Container x={props.at.x} y={props.at.y} scale={props.at.w / D}>
	<Button sizes={{ width: D, height: D }} anchor={0.5} onpress={props.onpress} disabled={props.disabled}>
		{#snippet children({ center, hovered, pressed })}
			<Container {...center} scale={pressed ? 0.92 : hovered ? 1.05 : 1} alpha={props.disabled ? 0.4 : 1}>
				<Sprite key="fx_glow" anchor={0.5} width={D * 1.6} height={D * 1.6} alpha={props.active ? 0.6 : 0} blendMode="add" />
				<Sprite key="btn_round" anchor={0.5} width={D} height={D} />
				<Sprite key="fx_ring" anchor={0.5} width={D * 1.16} height={D * 1.16} alpha={props.active ? 1 : 0} />
				<Sprite key={props.icon} anchor={0.5} width={D * 0.52} height={D * 0.52} />
				{#if props.badge}
					<Container x={D * 0.36} y={-D * 0.36}>
						<Sprite key="btn_round" anchor={0.5} width={D * 0.46} height={D * 0.46} />
						<Text anchor={0.5} y={2} text={props.badge} style={textStyle.value(D * 0.2)} />
					</Container>
				{/if}
			</Container>
		{/snippet}
	</Button>
</Container>
