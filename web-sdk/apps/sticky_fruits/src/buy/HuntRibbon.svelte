<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';

	import type { Slot } from '../ui/layout';
	import { COLOR, textStyle } from '../game/theme';
	import { copyNow } from '../i18n/copy';

	// Small rouge ribbon shown while Bonus Hunt is on (beside the reels, or over the crest on phones).
	type Props = { at: Slot };

	const props: Props = $props();
	const text = $derived(copyNow());
</script>

<Container x={props.at.x} y={props.at.y} scale={props.at.scale}>
	<Sprite key="ribbon" anchor={0.5} width={320} height={72} />
	<Text anchor={0.5} y={2} text={text.huntRibbon} style={textStyle.display(26, { fill: COLOR.ivory, stroke: { color: COLOR.goldShadow, width: 2 } })} />
</Container>
