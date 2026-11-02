<script lang="ts">
	// Gilded Salon paytable: opens on the SDK modal name 'payTable' (same as the SDK
	// ModalPayTable). Symbol pays come from the math config; amounts follow the current bet.
	import type { Snippet } from 'svelte';

	import { stateModal } from 'state-shared';

	import { isSocial } from '../../i18n/copy';
	import { payTableContent } from './content';
	import ModalSalon from './ModalSalon.svelte';

	type Props = {
		/** Shown at the bottom of the modal (the game version, like the SDK modals). */
		children?: Snippet;
	};

	const props: Props = $props();
	const social = $derived(isSocial());
	const content = $derived(payTableContent(social));
</script>

{#if stateModal.modal?.name === 'payTable'}
	<ModalSalon
		{content}
		{social}
		version={props.children}
		onclose={() => (stateModal.modal = null)}
	/>
{/if}
