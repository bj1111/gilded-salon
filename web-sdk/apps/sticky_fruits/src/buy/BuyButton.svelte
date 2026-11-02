<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { sineInOut } from 'svelte/easing';
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { Button } from 'components-pixi';
	import { stateBet, stateBetDerived } from 'state-shared';

	import { stateBuy } from './stateBuy.svelte';
	import { huntActive } from './buyRules';
	import type { Slot } from '../ui/layout';
	import { BUY_PLAQUE } from '../ui/layout';
	import { getContext } from '../game/context';
	import { COLOR, textStyle } from '../game/theme';
	import { copyNow } from '../i18n/copy';
	import { runLoop } from '../motion/loop';

	// BUY BONUS plaque beside the reels. Gold normally; rouge with a slow pulse while Bonus Hunt is on.
	type Props = { at: Slot };

	const props: Props = $props();
	const context = getContext();
	const text = $derived(copyNow());
	const hunt = $derived(huntActive(stateBet.activeBetModeKey));
	const disabled = $derived(!context.stateXstateDerived.isIdle() || stateBetDerived.hasAutoBetCounter());
	const { w, h } = BUY_PLAQUE;

	const pulse = new Tween(0, { easing: sineInOut });
	onMount(() =>
		runLoop(async (alive) => {
			if (!hunt) {
				await pulse.set(0, { duration: 400 });
				return;
			}
			await pulse.set(0.7, { duration: 900 });
			if (!alive()) return;
			await pulse.set(0.15, { duration: 900 });
		}),
	);

	const open = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBuy.open = true;
	};
</script>

<Container x={props.at.x} y={props.at.y} scale={props.at.scale}>
	<Button sizes={{ width: w, height: h }} anchor={0.5} onpress={open} {disabled}>
		{#snippet children({ center, hovered, pressed })}
			<Container {...center} scale={pressed ? 0.94 : hovered ? 1.04 : 1} alpha={disabled ? 0.45 : 1}>
				<Sprite key="fx_rouge" anchor={0.5} width={w * 1.5} height={h * 1.9} alpha={pulse.current} blendMode="add" />
				<Sprite key={hunt ? 'btn_buy_hunt' : 'btn_buy'} anchor={0.5} width={w} height={h} />
				<Text
					anchor={0.5}
					x={w * 0.1}
					y={2}
					text={hunt ? text.huntOn : text.buyButton}
					style={textStyle.display(h * 0.24, {
						fill: hunt ? COLOR.ivory : COLOR.lacquer,
						stroke: { color: hunt ? COLOR.goldShadow : COLOR.goldLight, width: 1 },
						dropShadow: false,
						align: 'center',
						wordWrap: true,
						wordWrapWidth: w * 0.6,
						letterSpacing: h * 0.01,
					})}
				/>
			</Container>
		{/snippet}
	</Button>
</Container>
