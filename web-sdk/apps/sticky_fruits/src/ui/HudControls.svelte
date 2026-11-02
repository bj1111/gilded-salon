<script lang="ts">
	import { stateBet, stateBetDerived, stateConfig, stateModal, stateUi } from 'state-shared';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { Container } from 'pixi-svelte';

	import RoundButton from './RoundButton.svelte';
	import SpinButton from './SpinButton.svelte';
	import ValueLabel from './ValueLabel.svelte';
	import WinField from './WinField.svelte';
	import type { Layout } from './layout';
	import { getContext } from '../game/context';
	import { copyNow } from '../i18n/copy';
	import { money } from '../game/money';
	import { huntActive } from '../buy/buyRules';
	import { nextBet } from './betSteps';

	// Normal play controls. Button logic mirrors the SDK's components-ui-pixi buttons (same state,
	// same events) so autoplay, turbo, slam-stop and bet levels behave exactly as the SDK intends.
	type Props = { layout: Layout; hotkeyDisabled: boolean };

	const props: Props = $props();
	const context = getContext();
	const text = $derived(copyNow());
	const idle = $derived(context.stateXstateDerived.isIdle());
	const press = () => context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
	const jurisdiction = $derived(stateConfig.jurisdiction ?? {});

	// balance rolls to its new value like a counter
	const balance = new Tween(stateBet.balanceAmount, { duration: 600, easing: cubicOut });
	$effect(() => {
		balance.set(stateBet.balanceAmount);
	});

	// bet levels come from authenticate (stateConfig.betAmountOptions)
	const options = $derived([...stateConfig.betAmountOptions].sort((a, b) => a - b));
	const smallest = $derived(options[0]);
	const biggest = $derived(options[options.length - 1]);
	const stepBet = (direction: 1 | -1) => {
		press();
		stateBetDerived.setBetAmount(nextBet(options, stateBet.betAmount, direction));
	};
	const openBetMenu = () => {
		if (!idle) return;
		press();
		stateModal.modal = { name: 'betAmountMenu' };
	};

	const autoActive = $derived(stateBetDerived.hasAutoBetCounter());
	const autoDisabled = $derived(
		stateBet.isSpaceHold || (!idle && !autoActive) || !stateBetDerived.isBetCostAvailable(),
	);
	const onAuto = () => {
		press();
		if (autoActive) stateBet.autoSpinsCounter = 0;
		else stateModal.modal = { name: 'autoSpin' };
	};

	const onTurbo = () => {
		press();
		stateBetDerived.updateIsTurbo(!stateBet.isTurbo, { persistent: true });
	};
	// slam-stop speeds the rest of the round up; turbo drops back when the next round can stop again
	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => stateBetDerived.updateIsTurbo(true, { persistent: false }),
		stopButtonEnable: () => stateBetDerived.updateIsTurbo(false, { persistent: false }),
	});

	const onMenu = () => {
		press();
		stateUi.menuOpen = true;
	};

	const autoBadge = $derived(
		autoActive ? (stateBet.autoSpinsCounter === Infinity ? '∞' : String(stateBet.autoSpinsCounter)) : undefined,
	);
</script>

<WinField at={props.layout.win} caption={text.win} sizes={props.layout.text} />

<RoundButton at={props.layout.menu} icon="icon_menu" onpress={onMenu} />

<ValueLabel at={props.layout.balance} caption={text.balance} value={money(balance.current, stateBet.balanceAmount)} sizes={props.layout.text} />

{#if !jurisdiction.disabledAutoplay}
	<RoundButton at={props.layout.auto} icon="icon_auto" onpress={onAuto} disabled={autoDisabled} active={autoActive} badge={autoBadge} />
{/if}

<SpinButton at={props.layout.spin} hotkeyDisabled={props.hotkeyDisabled} />

{#if !jurisdiction.disabledTurbo}
	<RoundButton at={props.layout.turbo} icon="icon_turbo" onpress={onTurbo} disabled={stateBet.isSpaceHold} active={stateBet.isTurbo} />
{/if}

<RoundButton at={props.layout.minus} icon="icon_minus" onpress={() => stepBet(-1)} disabled={!idle || stateBet.betAmount <= smallest} />
<Container eventMode="static" cursor={idle ? 'pointer' : 'not-allowed'} onpointerup={openBetMenu}>
	<ValueLabel
		at={props.layout.bet}
		caption={huntActive(stateBet.activeBetModeKey) ? text.huntBetLabel(stateBetDerived.activeBetMode()?.costMultiplier ?? 1) : text.bet}
		value={money(stateBetDerived.betCost())}
		sizes={props.layout.text}
	/>
</Container>
<RoundButton at={props.layout.plus} icon="icon_plus" onpress={() => stepBet(1)} disabled={!idle || stateBet.betAmount >= biggest} />
