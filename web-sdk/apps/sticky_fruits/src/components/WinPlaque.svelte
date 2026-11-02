<script lang="ts" module>
	import type { WinTier } from '../presentation/winTiers';

	export type EmitterEventWinPlaque = { type: 'winPlaque'; amount: number; tier: WinTier; fast: boolean };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut, linear } from 'svelte/easing';

	import { Container, Sprite } from 'pixi-svelte';
	import { waitForTimeout } from 'utils-shared/wait';

	import CounterText from './CounterText.svelte';
	import { getContext } from '../game/context';
	import { bookMoney } from '../game/money';
	import { gameLayout } from '../game/stateLayout';
	import { BOARD_SIZES } from '../game/constants';
	import { COLOR } from '../game/theme';
	import { countUpMs } from '../presentation/winTiers';

	// Wins below BIG WIN: an amount plaque rises over the lower reels and counts up; "great" wins
	// add a chip burst. It never blocks input and clears itself.
	const context = getContext();
	const PLAQUE = { w: 320, h: 80 };
	const SFX = { small: 'winSmall', nice: 'winNice', great: 'winGreat' } as const;

	let amount = $state(0);
	let tier = $state<WinTier>('small');
	let visible = $state(false);
	const count = new Tween(0, { easing: linear });
	const show = new Tween(0, { duration: 260, easing: backOut });

	const board = $derived(context.stateGameDerived.boardLayout());
	const position = $derived({ x: board.x, y: board.y + (BOARD_SIZES.height / 2 - 52) * board.scale });

	context.eventEmitter.subscribeOnMount({
		winPlaque: async (event) => {
			amount = event.amount;
			tier = event.tier;
			visible = true;
			await count.set(0, { duration: 0 });
			const ms = countUpMs(event.tier, { fast: event.fast });
			const name = SFX[event.tier as keyof typeof SFX];
			if (name) context.eventEmitter.broadcast({ type: 'sfx', name });
			if (event.tier === 'great') {
				const u = gameLayout().u;
				context.eventEmitter.broadcast({
					type: 'fxBurst',
					unit: u,
					burst: { x: position.x, y: position.y, count: 18, kind: 'chip', angle: -Math.PI / 2, spread: 1.6, speed: [0.45, 0.9] },
				});
				context.eventEmitter.broadcast({
					type: 'fxBurst',
					unit: u,
					burst: { x: position.x, y: position.y, count: 10, kind: 'glint', spread: Math.PI * 2, speed: [0.1, 0.35], gravity: 0 },
				});
			}
			show.target = 1;
			await count.set(event.amount, { duration: ms, easing: cubicOut });
			await waitForTimeout(event.fast ? 220 : 520);
			await show.set(0, { duration: 200, easing: cubicOut });
			visible = false;
		},
	});
</script>

{#if visible}
	<Container x={position.x} y={position.y} scale={board.scale * (0.85 + show.current * 0.15)} alpha={Math.min(1, show.current)}>
		<Sprite key="fx_glow" anchor={0.5} width={PLAQUE.w * 1.4} height={PLAQUE.h * 2.4} alpha={tier === 'small' ? 0.25 : 0.55} blendMode="add" />
		<Sprite key="plaque" anchor={0.5} width={PLAQUE.w} height={PLAQUE.h} />
		<CounterText
			text={bookMoney(count.current, amount)}
			size={tier === 'small' ? 34 : 40}
			y={-1}
			style={{ fill: tier === 'small' ? COLOR.ivory : COLOR.gold }}
		/>
	</Container>
{/if}
