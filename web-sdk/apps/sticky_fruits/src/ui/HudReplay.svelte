<script lang="ts">
	import { onMount } from 'svelte';

	import { Container, Sprite, Text } from 'pixi-svelte';
	import { Button } from 'components-pixi';
	import { stateBet, stateBetDerived } from 'state-shared';

	import RoundButton from './RoundButton.svelte';
	import ValueLabel from './ValueLabel.svelte';
	import WinField from './WinField.svelte';
	import type { Layout } from './layout';
	import { getContext } from '../game/context';
	import { copyNow } from '../i18n/copy';
	import { money } from '../game/money';
	import { textStyle } from '../game/theme';
	import { stateUi } from 'state-shared';

	// Replay mode (replay=true): no betting controls and no wallet calls. The player presses PLAY
	// to watch the recorded round, then PLAY AGAIN as often as they like. The SDK has already loaded
	// the round into stateBet.betToResume; resuming it plays it through the normal book handlers.
	type Props = { layout: Layout };

	const props: Props = $props();
	const context = getContext();
	const text = $derived(copyNow());
	const idle = $derived(context.stateXstateDerived.isIdle());
	const D = 200;

	let recorded: typeof stateBet.betToResume = null;
	let played = $state(false);

	onMount(() => {
		recorded = $state.snapshot(stateBet.betToResume) as typeof stateBet.betToResume;
	});

	const play = () => {
		if (!idle || !recorded) return;
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		stateBet.winBookEventAmount = 0;
		stateBet.betToResume = structuredClone(recorded);
		played = true;
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};

	const onMenu = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateUi.menuOpen = true;
	};
</script>

<WinField at={props.layout.win} caption={text.win} sizes={props.layout.text} />
<RoundButton at={props.layout.menu} icon="icon_menu" onpress={onMenu} />
<ValueLabel at={props.layout.balance} caption={text.replay} value="" sizes={props.layout.text} />
<!-- the real cost of the recorded round (amount x mode cost) -->
<ValueLabel at={props.layout.bet} caption={text.bet} value={money(stateBetDerived.betCost())} sizes={props.layout.text} />

<Container x={props.layout.spin.x} y={props.layout.spin.y} scale={props.layout.spin.w / D}>
	<Button sizes={{ width: D, height: D }} anchor={0.5} onpress={play} disabled={!idle}>
		{#snippet children({ center, hovered, pressed })}
			<Container {...center} scale={pressed ? 0.94 : hovered ? 1.03 : 1} alpha={idle ? 1 : 0.5}>
				<Sprite key="fx_glow" anchor={0.5} width={D * 1.6} height={D * 1.6} alpha={idle ? 0.5 : 0} blendMode="add" />
				<Sprite key="spin_ring" anchor={0.5} width={D} height={D} />
				<Sprite key="spin_core" anchor={0.5} width={D * 0.7} height={D * 0.7} />
				<Text anchor={0.5} y={3} text={played ? text.playAgain : text.play} style={textStyle.caption(played ? 15 : 22, { fill: 0xf5ecd9, letterSpacing: 3 })} />
			</Container>
		{/snippet}
	</Button>
</Container>
