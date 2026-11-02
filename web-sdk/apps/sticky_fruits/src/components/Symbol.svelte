<script lang="ts">
	import SymbolSpine from './SymbolSpine.svelte';
	import SymbolSprite from './SymbolSprite.svelte';
	import SymbolArt from './SymbolArt.svelte';
	import { getSymbolInfo } from '../game/utils';
	import type { SymbolState, RawSymbol } from '../game/types';
	import { getContext } from '../game/context';

	type Props = {
		x?: number;
		y?: number;
		state: SymbolState;
		rawSymbol: RawSymbol;
		oncomplete?: () => void;
		loop?: boolean;
	};

	const props: Props = $props();
	const context = getContext();
	const symbolInfo = $derived(getSymbolInfo({ rawSymbol: props.rawSymbol, state: props.state }));
</script>

{#if symbolInfo.type === 'art'}
	<SymbolArt
		x={props.x}
		y={props.y}
		name={props.rawSymbol.name}
		pulse={symbolInfo.pulse}
		blur={symbolInfo.blur}
		oncomplete={props.oncomplete}
	/>
{:else if symbolInfo.type === 'sprite'}
	<SymbolSprite {symbolInfo} x={props.x} y={props.y} oncomplete={props.oncomplete} />
{:else}
	<SymbolSpine
		loop={props.loop}
		{symbolInfo}
		x={props.x}
		y={props.y}
		showWinFrame={props.state === 'win' && props.rawSymbol.name !== 'S'}
		listener={{ complete: props.oncomplete }}
	/>
{/if}
