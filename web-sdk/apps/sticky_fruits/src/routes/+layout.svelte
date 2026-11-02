<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';

	import Game from '../components/Game.svelte';
	import HtmlLoader from '../components/HtmlLoader.svelte';
	import { setContext } from '../game/context';
	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };

	const props: Props = $props();

	setContext();
</script>

<GlobalStyle>
	<Authenticate>
		<LoadI18n {messagesMap}>
			<Game />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

<!-- our own branded loader (the Stake Engine and SDK sample loaders are not allowed in review) -->
<HtmlLoader />

{@render props.children()}
