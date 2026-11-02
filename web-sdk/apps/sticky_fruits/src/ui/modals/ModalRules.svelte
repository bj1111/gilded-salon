<script lang="ts">
	// Gilded Salon game rules: opens on the SDK modal name 'gameRules' (same as the SDK
	// ModalGameRules). Covers how wins form, features, RTP, max win, controls and the disclaimer.
	import type { Snippet } from 'svelte';

	import { stateModal } from 'state-shared';

	import { isSocial } from '../../i18n/copy';
	import { rulesContent } from './content';
	import ModalSalon from './ModalSalon.svelte';

	type Props = {
		/** Shown at the bottom of the modal (the game version, like the SDK modals). */
		children?: Snippet;
	};

	const props: Props = $props();
	const social = $derived(isSocial());
	const content = $derived(rulesContent(social));
</script>

{#if stateModal.modal?.name === 'gameRules'}
	<ModalSalon
		{content}
		{social}
		version={props.children}
		onclose={() => (stateModal.modal = null)}
	/>
{/if}
