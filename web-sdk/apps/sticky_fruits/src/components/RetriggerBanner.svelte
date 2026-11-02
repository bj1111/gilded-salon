<script lang="ts" module>
	export type EmitterEventRetrigger = { type: 'retriggerBanner'; added: number; fast: boolean };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';

	import { Container, Sprite, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { gameLayout } from '../game/stateLayout';
	import { textStyle } from '../game/theme';
	import { copyNow } from '../i18n/copy';
	import { wait } from '../motion/loop';

	// "+5 FREE SPINS" pops over the reels when keys retrigger the bonus.
	const context = getContext();
	let visible = $state(false);
	let added = $state(5);
	const pop = new Tween(0, { duration: 460, easing: backOut });
	const board = $derived(context.stateGameDerived.boardLayout());
	const text = $derived(copyNow());

	context.eventEmitter.subscribeOnMount({
		retriggerBanner: async (event) => {
			added = event.added;
			visible = true;
			const u = gameLayout().u;
			context.eventEmitter.broadcast({
				type: 'fxBurst',
				unit: u,
				burst: { x: board.x, y: board.y, count: 12, kind: 'glint', spread: Math.PI * 2, speed: [0.15, 0.45], gravity: 0 },
			});
			await pop.set(1);
			await wait(event.fast ? 650 : 1250);
			await pop.set(0, { duration: 220, easing: cubicOut });
			visible = false;
		},
	});
</script>

{#if visible}
	<Container x={board.x} y={board.y} scale={board.scale * pop.current}>
		<Sprite key="fx_rouge" anchor={0.5} width={620} height={300} alpha={0.7} blendMode="add" />
		<Text anchor={0.5} text={text.retrigger(added)} style={textStyle.display(64)} />
	</Container>
{/if}
