<script lang="ts" module>
	export type EmitterEventLanding =
		| { type: 'symbolLanded'; reel: number; row: number; name: string }
		| { type: 'reelLanded'; reel: number };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { Container, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { getSymbolX, getSymbolY } from '../game/utils';
	import { BOARD_SIZES, SYMBOL_SIZE } from '../game/constants';

	// Small, quick feedback as reels land (board units): a brass divider glints as each reel stops,
	// a wild chip throws a gold ring, a key flashes rouge.
	type Burst = { id: number; x: number; y: number; kind: 'wild' | 'key'; t: Tween<number> };

	const context = getContext();
	let bursts = $state<Burst[]>([]);
	const dividers = Array.from({ length: 4 }, () => new Tween(0, { easing: cubicOut }));
	let nextId = 0;

	const burst = async (kind: Burst['kind'], reel: number, row: number) => {
		const t = new Tween(0, { duration: kind === 'wild' ? 520 : 650, easing: cubicOut });
		const item = { id: nextId++, x: getSymbolX(reel), y: getSymbolY(row), kind, t };
		bursts = [...bursts, item];
		await t.set(1);
		bursts = bursts.filter((b) => b.id !== item.id);
	};

	context.eventEmitter.subscribeOnMount({
		symbolLanded: ({ reel, row, name }) => {
			if (name === 'W') burst('wild', reel, row);
			if (name === 'S') burst('key', reel, row);
		},
		reelLanded: async ({ reel }) => {
			const divider = dividers[reel];
			if (!divider) return;
			await divider.set(1, { duration: 60 });
			await divider.set(0, { duration: 380 });
		},
	});
</script>

<Container>
	{#each dividers as divider, i (i)}
		{#if divider.current > 0.01}
			<Sprite
				key="fx_divider"
				anchor={{ x: 0.5, y: 0 }}
				x={SYMBOL_SIZE * (i + 1)}
				y={0}
				width={18}
				height={BOARD_SIZES.height}
				alpha={divider.current * 0.9}
				blendMode="add"
			/>
		{/if}
	{/each}
	{#each bursts as b (b.id)}
		{#if b.kind === 'wild'}
			<Sprite key="fx_ring" anchor={0.5} x={b.x} y={b.y} width={SYMBOL_SIZE * (0.6 + b.t.current * 0.8)} height={SYMBOL_SIZE * (0.6 + b.t.current * 0.8)} alpha={1 - b.t.current} />
		{:else}
			<Sprite key="fx_rouge" anchor={0.5} x={b.x} y={b.y} width={SYMBOL_SIZE * 1.8} height={SYMBOL_SIZE * 1.8} alpha={(1 - b.t.current) * 0.9} blendMode="add" />
			<Sprite key="fx_glint" anchor={0.5} x={b.x + 30} y={b.y - 34} width={56 * (1 - b.t.current * 0.5)} height={56 * (1 - b.t.current * 0.5)} rotation={b.t.current} alpha={1 - b.t.current} blendMode="add" />
		{/if}
	{/each}
</Container>
