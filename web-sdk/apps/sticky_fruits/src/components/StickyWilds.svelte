<script lang="ts" module>
	import type { Position } from '../game/types';

	export type EmitterEventStickyWilds =
		| { type: 'stickyWildsLock'; positions: Position[] }
		| { type: 'chipsSweep' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicIn, cubicOut, linear } from 'svelte/easing';

	import { Container, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { getSymbolX, getSymbolY } from '../game/utils';
	import { BOARD_SIZES, SYMBOL_SIZE } from '../game/constants';
	import { ART_GEOMETRY } from '../game/artAssets';
	import SymbolArt from './SymbolArt.svelte';

	// Free-spin wilds that stay: each new Golden Chip drops onto the felt, spins on its edge and
	// settles with a clack. They sit above the spinning reels (hiding them) and below the win layer.
	// At the end of the bonus a croupier's rake sweeps them off the table.
	const context = getContext();
	const key = (position: Position) => `${position.reel}-${position.row}`;
	const DROP = 420;

	type Drop = { t: Tween<number> };
	let drops = $state<Record<string, Drop>>({});
	const rake = new Tween(0, { easing: linear });
	let sweeping = $state(false);
	const RAKE = ART_GEOMETRY.sizes.rake;

	const dropChip = async (position: Position, delay: number) => {
		const t = new Tween(0, { easing: linear });
		drops = { ...drops, [key(position)]: { t } };
		await new Promise((resolve) => setTimeout(resolve, delay));
		await t.set(0.5, { duration: DROP * 0.5, easing: cubicIn });
		context.eventEmitter.broadcast({ type: 'sfx', name: 'chipLock' });
		context.eventEmitter.broadcast({ type: 'symbolLanded', reel: position.reel, row: position.row - 1, name: 'W' });
		await t.set(1, { duration: DROP, easing: cubicOut });
		const { [key(position)]: _done, ...rest } = drops;
		drops = rest;
	};

	context.eventEmitter.subscribeOnMount({
		stickyWildsLock: async ({ positions }) => {
			await Promise.all(positions.map((position, i) => dropChip(position, i * 120)));
		},
		chipsSweep: async () => {
			if (context.stateGame.stickyWilds.length === 0) return;
			sweeping = true;
			await rake.set(0, { duration: 0 });
			await rake.set(1, { duration: 1100 });
			sweeping = false;
		},
	});

	// drop phase 0..0.5 falls in from above; 0.5..1 is the edge spin settling flat
	const dropY = (t: number) => (t < 0.5 ? -SYMBOL_SIZE * 1.4 * (1 - t / 0.5) : 0);
	const dropScaleX = (t: number) => (t < 0.5 ? 1 : 0.25 + 0.75 * Math.abs(Math.cos((t - 0.5) * 2 * Math.PI * 1.5)) * (t > 0.9 ? 1 : 1));
	// the rake travels right to left; chips it has reached are pushed ahead of it
	const rakeX = $derived(BOARD_SIZES.width + 120 - rake.current * (BOARD_SIZES.width + 420));
	const pushed = (x: number) => (sweeping ? Math.min(x, rakeX - SYMBOL_SIZE * 0.55) : x);
</script>

{#each context.stateGame.stickyWilds as wild (key(wild))}
	<!-- math rows include one padding row on top -->
	{@const drop = drops[key(wild)]}
	{@const x = pushed(getSymbolX(wild.reel))}
	{@const y = getSymbolY(wild.row - 1)}
	<Container
		x={x}
		y={y + (drop ? dropY(drop.t.current) : 0)}
		scale={{ x: drop ? dropScaleX(drop.t.current) : 1, y: 1 }}
		alpha={(drop && drop.t.current < 0.05 ? drop.t.current * 20 : 1) * (sweeping ? Math.max(0, Math.min(1, (x + 40) / 120)) : 1)}
	>
		<SymbolArt name="W" sticky pulse={false} />
	</Container>
{/each}

{#if sweeping}
	<Sprite key="rake" anchor={{ x: 0.86, y: 0.5 }} x={rakeX} y={BOARD_SIZES.height / 2} width={RAKE.w * 1.1} height={RAKE.h * 1.1} rotation={Math.PI} />
{/if}
