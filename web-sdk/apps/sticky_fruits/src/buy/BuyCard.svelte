<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { Button } from 'components-pixi';

	import { COLOR, textStyle } from '../game/theme';

	// One option in the buy menu. Tall (360 x 460) side by side, or wide (640 x 250) stacked on phones.
	type Props = {
		x: number;
		y: number;
		wide: boolean;
		icon: string;
		name: string;
		description: string;
		price: string;
		action: string;
		affordable: boolean;
		tooLow: string;
		active?: boolean;
		onpress: () => void;
	};

	const props: Props = $props();
	const size = $derived(props.wide ? { w: 640, h: 250 } : { w: 360, h: 460 });
	// positions of the parts, relative to the card centre
	const at = $derived(
		props.wide
			? { icon: { x: -228, y: 0, s: 140 }, text: { x: 80, wrap: 400 }, name: -82, desc: -46, price: 30, button: { x: 80, y: 82 } }
			: { icon: { x: 0, y: -132, s: 150 }, text: { x: 0, wrap: 300 }, name: -24, desc: 30, price: 112, button: { x: 0, y: 176 } },
	);
	// Limelight capitals run ~0.86 em wide with the display letter-spacing; shrink long names to fit
	const NAME_SIZE = 28;
	const nameFit = $derived(Math.min(1, at.text.wrap / (props.name.length * NAME_SIZE * 0.86)));
	const BTN = { w: 220, h: 70 };
</script>

<Container x={props.x} y={props.y}>
	<Sprite key={props.wide ? 'card_wide' : 'card'} anchor={0.5} width={size.w} height={size.h} />
	{#if props.active}
		<Sprite key="fx_rouge" anchor={0.5} width={size.w * 1.1} height={size.h * 1.1} alpha={0.35} blendMode="add" />
	{/if}
	<Sprite key={props.icon} anchor={0.5} x={at.icon.x} y={at.icon.y} width={at.icon.s} height={at.icon.s} />
	<Text anchor={0.5} x={at.text.x} y={at.name} scale={nameFit} text={props.name} style={textStyle.display(NAME_SIZE, { align: 'center' })} />
	<Text
		anchor={{ x: 0.5, y: 0 }}
		x={at.text.x}
		y={at.desc}
		text={props.description}
		style={textStyle.body(18, { align: 'center', wordWrap: true, wordWrapWidth: at.text.wrap, lineHeight: 24 })}
	/>
	<Text
		anchor={0.5}
		x={at.text.x}
		y={at.price}
		text={props.affordable ? props.price : props.tooLow}
		style={textStyle.value(24, { fill: props.affordable ? COLOR.gold : COLOR.rouge })}
	/>
	<Container x={at.button.x} y={at.button.y}>
		<Button sizes={{ width: BTN.w, height: BTN.h }} anchor={0.5} onpress={props.onpress} disabled={!props.affordable}>
			{#snippet children({ center, hovered, pressed })}
				<Container {...center} scale={pressed ? 0.94 : hovered ? 1.04 : 1} alpha={props.affordable ? 1 : 0.4}>
					<Sprite key={props.active ? 'btn_buy_hunt' : 'btn_buy'} anchor={0.5} width={BTN.w} height={BTN.h} />
					<Text
						anchor={0.5}
						x={BTN.w * 0.08}
						y={1}
						text={props.action}
						style={textStyle.display(24, {
							fill: props.active ? COLOR.ivory : COLOR.lacquer,
							stroke: { color: props.active ? COLOR.goldShadow : COLOR.goldLight, width: 1 },
							dropShadow: false,
						})}
					/>
				</Container>
			{/snippet}
		</Button>
	</Container>
</Container>
