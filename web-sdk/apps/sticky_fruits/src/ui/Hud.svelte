<script lang="ts">
	import { EnableSpaceHold } from 'components-shared';
	import { stateBet, stateConfig, stateModal, stateUi } from 'state-shared';
	// fades the HUD out and back in on the SDK's uiHide / uiShow events
	import UiFadeContainer from 'components-ui-pixi/src/components/UiFadeContainer.svelte';

	import Rail from './Rail.svelte';
	import HudControls from './HudControls.svelte';
	import HudReplay from './HudReplay.svelte';
	import MenuOverlay from './MenuOverlay.svelte';
	import { gameLayout } from '../game/stateLayout';
	import { getContext } from '../game/context';
	import { spaceBlocked } from './keyGate.svelte';
	import BuyButton from '../buy/BuyButton.svelte';
	import BuyMenu from '../buy/BuyMenu.svelte';
	import { stateBuy } from '../buy/stateBuy.svelte';
	import { buyAvailable, buyButtonShown, huntActive } from '../buy/buyRules';
	import HuntRibbon from '../buy/HuntRibbon.svelte';

	// The game's own HUD (replaces the SDK's components-ui-pixi <UI>); positions come from
	// ui/layout.ts for the current layout type.
	const context = getContext();
	const layout = $derived(gameLayout());
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const replay = $derived(stateUi.config.mode === 'replay');
	const blocked = $derived(Boolean(stateModal.modal) || stateUi.menuOpen || stateBuy.open || spaceBlocked());
	const jurisdiction = $derived(stateConfig.jurisdiction ?? {});
	// holding Space plays continuously in turbo; not where turbo or the spacebar is disallowed
	const canBuy = $derived(buyAvailable(stateConfig.jurisdiction, replay));
	const spaceHold = $derived(!replay && !blocked && !jurisdiction.disabledSpacebar && !jurisdiction.disabledTurbo);
</script>

{#if spaceHold}
	<EnableSpaceHold />
{/if}

<UiFadeContainer>
	<Rail {layout} canvasWidth={canvas.width} />
	{#if replay}
		<HudReplay {layout} />
	{:else}
		<HudControls {layout} hotkeyDisabled={blocked} />
		{#if buyButtonShown(stateConfig.jurisdiction, replay, context.stateGame.gameType)}
			<BuyButton at={layout.buy} />
		{/if}
		{#if layout.ribbon && huntActive(stateBet.activeBetModeKey)}
			<HuntRibbon at={layout.ribbon} />
		{/if}
	{/if}
</UiFadeContainer>

{#if canBuy && stateBuy.open}
	<BuyMenu />
{/if}

{#if stateUi.menuOpen}
	<MenuOverlay {layout} />
{/if}
