<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { linear, sineInOut, cubicOut } from 'svelte/easing';

	import { Container, Sprite } from 'pixi-svelte';
	import { Button } from 'components-pixi';
	import { OnHotkey } from 'components-shared';
	import { stateBet, stateBetDerived, stateConfig } from 'state-shared';
	// the SDK's provider decides spin vs stop and wires bet/stop events; we only restyle it
	import ButtonBetProvider from 'components-ui-pixi/src/components/ButtonBetProvider.svelte';

	import type { Slot } from './layout';
	import { getContext } from '../game/context';
	import { runLoop } from '../motion/loop';

	// The spin dial: grooved brass ring around a lacquer core. The ring turns like a roulette wheel
	// while a round plays; idle it breathes a soft glow, and it warms up after a win.
	// hotkeyDisabled: a menu or modal is open, so Space must not start a round
	type Props = { at: Slot; hotkeyDisabled?: boolean };

	const props: Props = $props();
	const context = getContext();
	const D = 200;
	const ring = new Tween(0, { easing: linear });
	const breathe = new Tween(0.25, { easing: sineInOut });
	const spinning = $derived(!context.stateXstateDerived.isIdle());
	const won = $derived(stateBet.winBookEventAmount > 0);

	onMount(() => {
		const stopRing = runLoop(async () => {
			if (spinning) {
				await ring.set(ring.current + Math.PI, { duration: 520, easing: linear });
			} else {
				// settle softly, then wait for the next round
				await ring.set(ring.current + 0.4, { duration: 600, easing: cubicOut });
				await new Promise((resolve) => setTimeout(resolve, 120));
			}
		});
		const stopBreathe = runLoop(async () => {
			await breathe.set(0.5, { duration: 1600 });
			await breathe.set(0.22, { duration: 1600 });
		});
		return () => {
			stopRing();
			stopBreathe();
		};
	});

	const blocked = (key: string) => {
		if (key.endsWith('disabled')) return true;
		if (!stateBetDerived.isBetCostAvailable()) return true;
		// jurisdictions without slam-stop: stop only cancels autoplay
		return key.startsWith('stop') && Boolean(stateConfig.jurisdiction?.disabledSlamstop) && !stateBetDerived.hasAutoBetCounter();
	};
</script>

<ButtonBetProvider>
	{#snippet children({ key, onpress })}
		{@const disabled = blocked(key)}
		{@const isStop = key.startsWith('stop')}
		{#if !stateConfig.jurisdiction?.disabledSpacebar}
			<OnHotkey hotkey="Space" disabled={props.hotkeyDisabled || !stateBetDerived.isBetCostAvailable() || disabled} {onpress} />
		{/if}
		<Container x={props.at.x} y={props.at.y} scale={props.at.w / D}>
			<Button sizes={{ width: D, height: D }} anchor={0.5} {onpress} {disabled}>
				{#snippet children({ center, hovered, pressed })}
					<Container {...center} scale={pressed ? 0.94 : hovered ? 1.03 : 1}>
						<Sprite
							key="fx_glow"
							anchor={0.5}
							width={D * 1.7}
							height={D * 1.7}
							alpha={disabled ? 0 : won && !spinning ? 0.75 : breathe.current}
							blendMode="add"
						/>
						<Container alpha={disabled && !isStop ? 0.5 : 1}>
							<Sprite key="spin_ring" anchor={0.5} width={D} height={D} rotation={ring.current} />
							<Sprite key="spin_core" anchor={0.5} width={D * 0.7} height={D * 0.7} />
							<Sprite
								key={isStop ? 'icon_stop' : 'icon_spin'}
								anchor={0.5}
								width={D * (isStop ? 0.34 : 0.4)}
								height={D * (isStop ? 0.34 : 0.4)}
								rotation={isStop ? 0 : -ring.current * 0.5}
								alpha={disabled ? 0.45 : 1}
							/>
						</Container>
					</Container>
				{/snippet}
			</Button>
		</Container>
	{/snippet}
</ButtonBetProvider>
