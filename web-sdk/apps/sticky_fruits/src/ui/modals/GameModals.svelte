<script lang="ts">
	// Replaces the SDK <Modals> in the game. Keeps the SDK's functional modals (error, bet menu,
	// autoplay + its stop message, settings) and swaps in Gilded Salon's own paytable and rules.
	// No buy-bonus modals: the game has a single `base` mode and no buy mode.
	//
	// The SDK modals are deep-imported: components-ui-html has no exports map, and its index only
	// exports the full <Modals>, which would also mount the SDK placeholder paytable/rules.
	import type { Snippet } from 'svelte';

	import ModalError from 'components-ui-html/src/components/ModalError.svelte';
	import ModalBetMenu from 'components-ui-html/src/components/ModalBetMenu.svelte';
	import ModalAutoSpin from 'components-ui-html/src/components/ModalAutoSpin.svelte';
	import ModalAutoSpinMessage from 'components-ui-html/src/components/ModalAutoSpinMessage.svelte';
	import ModalSettings from 'components-ui-html/src/components/ModalSettings.svelte';

	import { applySocialSdkWording, isSocial } from '../../i18n/copy';
	import ModalPayTable from './ModalPayTable.svelte';
	import ModalRules from './ModalRules.svelte';

	type Props = {
		/** Rendered at the bottom of the paytable and rules (e.g. <GameVersion version="…" />). */
		version: Snippet;
	};

	const props: Props = $props();

	// Social mode: swap the restricted words inside the SDK modals' own strings
	// ("BET MENU", "SELECT YOUR BET", the insufficient-funds autoplay message…).
	$effect.pre(() => {
		if (isSocial()) applySocialSdkWording();
	});
</script>

<ModalError />
<ModalBetMenu />
<ModalAutoSpin />
<ModalAutoSpinMessage />
<ModalPayTable>
	{@render props.version()}
</ModalPayTable>
<ModalRules>
	{@render props.version()}
</ModalRules>
<ModalSettings />

<style>
	/* Same root sizing the SDK <Modals> sets; the SDK modals are sized in rem. Our own modals
	   use px/clamp so they stay readable when this halves the root size on narrow screens. */
	:global(html) {
		font-size: 16px;
	}

	@media screen and (max-width: 500px) {
		:global(html) {
			font-size: 50%;
		}
	}
</style>
