<script lang="ts">
	import { Container, Text } from 'pixi-svelte';

	import { layoutDigits } from '../presentation/digits';
	import { textStyle } from '../game/theme';

	// An amount drawn glyph-by-glyph on a fixed grid, centred on (x, y), so count-ups stay still.
	type Props = { text: string; size: number; x?: number; y?: number; style?: Record<string, unknown> };

	const props: Props = $props();
	const layout = $derived(layoutDigits(props.text, props.size));
	const style = $derived(textStyle.value(props.size, props.style ?? {}));
</script>

<Container x={props.x ?? 0} y={props.y ?? 0}>
	{#each layout.glyphs as glyph, i (i)}
		<Text anchor={0.5} x={glyph.x} text={glyph.char} {style} />
	{/each}
</Container>
