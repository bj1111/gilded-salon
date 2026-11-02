<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut, cubicInOut } from 'svelte/easing';

	import { Container, Sprite } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_ART_KEYS } from '../game/constants';
	import type { SymbolName } from '../game/types';

	type Props = {
		x?: number;
		y?: number;
		name: SymbolName;
		// winning: glow + two soft pulses, then oncomplete
		pulse: boolean;
		// spinning: the motion-blurred twin, stretched along the reel
		blur?: boolean;
		// locked wild in free spins: a gold ring sits under the chip
		sticky?: boolean;
		oncomplete?: () => void;
	};

	const props: Props = $props();
	const size = SYMBOL_SIZE * 0.94;
	const scale = new Tween(1, { easing: cubicInOut });
	const glow = new Tween(0, { duration: 180, easing: cubicOut });

	$effect(() => {
		if (!props.pulse) {
			glow.target = 0;
			props.oncomplete?.();
			return;
		}
		let cancelled = false;
		glow.target = 1;
		(async () => {
			for (let i = 0; i < 2 && !cancelled; i++) {
				await scale.set(1.12, { duration: 170 });
				await scale.set(1, { duration: 190 });
			}
			if (!cancelled) {
				glow.target = 0.35;
				props.oncomplete?.();
			}
		})();
		return () => (cancelled = true);
	});
</script>

<Container x={props.x} y={props.y} scale={scale.current}>
	{#if props.sticky}
		<Sprite key="fx_ring" anchor={0.5} width={SYMBOL_SIZE * 1.02} height={SYMBOL_SIZE * 1.02} />
	{/if}
	<!-- always mounted (alpha animated) so it stays behind the symbol in draw order -->
	<Sprite key="fx_glow" anchor={0.5} width={SYMBOL_SIZE * 1.25} height={SYMBOL_SIZE * 1.25} alpha={glow.current * 0.8} blendMode="add" />
	{#if props.blur}
		<Sprite key={`${SYMBOL_ART_KEYS[props.name]}_blur`} anchor={0.5} width={size} height={size * 1.25} />
	{:else}
		<Sprite key={SYMBOL_ART_KEYS[props.name]} anchor={0.5} width={size} height={size} />
	{/if}
</Container>
