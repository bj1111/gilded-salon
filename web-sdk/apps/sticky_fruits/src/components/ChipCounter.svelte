<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { gameLayout } from '../game/stateLayout';
	import { textStyle } from '../game/theme';
	import { copyNow } from '../i18n/copy';

	// During free spins: how many Golden Chips are locked on the felt (from the book's sticky wilds).
	const context = getContext();
	const layout = $derived(gameLayout());
	const count = $derived(context.stateGame.stickyWilds.length);
	const text = $derived(copyNow());
	const x = $derived(layout.win.x + layout.win.w / 2 + 16 * layout.u);
</script>

{#if context.stateGame.gameType === 'freegame'}
	<Container x={x} y={layout.win.y} scale={layout.u}>
		<Sprite key="sym_W" anchor={{ x: 0, y: 0.5 }} width={58} height={58} />
		<Text anchor={{ x: 0, y: 0.5 }} x={66} y={3} text={`× ${count}`} style={textStyle.value(layout.text.value)} />
		<Text anchor={{ x: 0, y: 1 }} x={0} y={-34} text={text.chipsOnTheFelt} style={textStyle.caption(layout.text.caption * 0.7)} />
	</Container>
{/if}
