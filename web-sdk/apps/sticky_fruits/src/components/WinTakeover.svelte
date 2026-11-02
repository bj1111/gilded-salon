<script lang="ts" module>
	export type EmitterEventWinTakeover = { type: 'winTakeover'; amount: number; fast: boolean };
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut, sineInOut, linear } from 'svelte/easing';

	import { Container, Rectangle, Sprite, Text } from 'pixi-svelte';
	import { waitForResolve } from 'utils-shared/wait';

	import CounterText from './CounterText.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { getContext } from '../game/context';
	import { holdSpace } from '../ui/keyGate.svelte';
	import { bookMoney } from '../game/money';
	import { gameLayout } from '../game/stateLayout';
	import { COLOR, textStyle } from '../game/theme';
	import { copyNow } from '../i18n/copy';
	import { countUpMs, takeoverSteps, tierForAmount, type WinTier } from '../presentation/winTiers';
	import { runLoop, wait, between } from '../motion/loop';

	// BIG WIN and above take over the screen: the room dims, deco rays turn slowly behind the
	// banner, chips rain, and the amount counts up. The banner climbs BIG -> GRAND -> MEGA ->
	// LEGENDARY as the counter passes each threshold; tap or Space skips to the end.
	const context = getContext();
	const BANNER = { w: 1100, h: 220 };
	const RAYS = 18;
	const STINGER = { big: 'tierBig', grand: 'tierGrand', mega: 'tierMega', legendary: 'tierLegendary', max: 'tierMax' } as const;

	let active = $state(false);
	let amount = $state(0);
	let steps = $state<{ tier: WinTier; at: number }[]>([]);
	let counting = $state(false);
	let skip = () => {};
	let close = () => {};

	const count = new Tween(0);
	const fade = new Tween(0, { duration: 320, easing: cubicOut });
	const punch = new Tween(1, { duration: 520, easing: backOut });
	const rays = new Tween(0, { easing: linear });
	const shake = new Tween(0, { duration: 420, easing: cubicOut });

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const u = $derived(gameLayout().u);
	const scale = $derived(Math.min((canvas.width * 0.9) / BANNER.w, u * 0.95, (canvas.height * 0.62) / 600));
	const banner = $derived(
		[...steps].reverse().find((step) => count.current >= step.at - 0.5)?.tier ?? steps[0]?.tier ?? 'big',
	);
	const text = $derived(copyNow());

	// every banner upgrade lands with a punch, a stinger and a burst of chips
	let shown: WinTier | null = null;
	$effect(() => {
		const tier = banner;
		if (!active || tier === shown) return;
		shown = tier;
		punch.set(1.35, { duration: 0 }).then(() => (punch.target = 1));
		context.eventEmitter.broadcast({ type: 'sfx', name: STINGER[tier as keyof typeof STINGER] ?? 'tierBig' });
		const centre = { x: canvas.width / 2, y: canvas.height * 0.42 };
		context.eventEmitter.broadcast({
			type: 'fxBurst',
			unit: u,
			burst: { ...centre, count: 26, kind: 'chip', spread: Math.PI * 2, speed: [0.35, 1.0], gravity: 0.0011 },
		});
		context.eventEmitter.broadcast({
			type: 'fxBurst',
			unit: u,
			burst: { ...centre, count: 14, kind: 'glint', spread: Math.PI * 2, speed: [0.15, 0.5], gravity: 0 },
		});
		if (tier === 'legendary' || tier === 'max') shake.set(1, { duration: 0 }).then(() => (shake.target = 0));
	});

	onMount(() =>
		runLoop(async (alive) => {
			if (!active) return wait(120);
			// chips keep raining from the top while the takeover is up
			context.eventEmitter.broadcast({
				type: 'fxBurst',
				unit: u,
				burst: {
					x: between(0.1, 0.9) * canvas.width,
					y: -40 * u,
					count: 3,
					kind: 'chip',
					angle: Math.PI / 2,
					spread: 0.6,
					speed: [0.08, 0.22],
					gravity: 0.0008,
					life: [1800, 2800],
				},
			});
			if (alive()) await wait(150);
		}),
	);

	context.eventEmitter.subscribeOnMount({
		winTakeover: async (event) => {
			const releaseSpace = holdSpace();
			amount = event.amount;
			steps = takeoverSteps(event.amount);
			shown = null;
			await count.set(0, { duration: 0 });
			active = true;
			fade.target = 1;
			rays.set(rays.current + Math.PI * 2, { duration: 60000 });

			// count up (skippable)
			const ms = countUpMs(tierForAmount(event.amount), { fast: event.fast });
			counting = true;
			context.eventEmitter.broadcast({ type: 'sfxLoop', name: 'countTick' });
			context.eventEmitter.broadcast({ type: 'sfxLoop', name: 'chipShower' });
			const stopPitch = runLoop(async () => {
				context.eventEmitter.broadcast({ type: 'sfx', name: 'countTick', index: count.current / Math.max(1, amount) });
				await wait(100);
			});
			await Promise.race([
				count.set(event.amount, { duration: ms, easing: sineInOut }),
				waitForResolve((resolve) => (skip = () => resolve(undefined))),
			]);
			await count.set(event.amount, { duration: 0 });
			stopPitch();
			counting = false;
			context.eventEmitter.broadcast({ type: 'sfxStop', name: 'countTick' });
			context.eventEmitter.broadcast({ type: 'sfx', name: 'countEnd' });

			// hold the final amount, then leave
			await Promise.race([wait(event.fast ? 900 : 2400), waitForResolve((resolve) => (close = () => resolve(undefined)))]);
			context.eventEmitter.broadcast({ type: 'sfxStop', name: 'chipShower' });
			await fade.set(0);
			active = false;
			releaseSpace();
			rays.set(rays.current, { duration: 0 });
			context.eventEmitter.broadcast({ type: 'fxClear' });
		},
	});

	const jitter = () => (Math.random() - 0.5) * 18 * u * shake.current;
</script>

{#if active}
	<Rectangle width={canvas.width} height={canvas.height} backgroundColor={COLOR.black} backgroundAlpha={0.78 * fade.current} />
	<Container x={canvas.width / 2 + jitter()} y={canvas.height * 0.42 + jitter()} scale={scale} alpha={fade.current}>
		<Container rotation={rays.current}>
			{#each Array.from({ length: RAYS }) as _, i (i)}
				<Sprite key="fx_ray" anchor={{ x: 0.5, y: 1 }} rotation={(i / RAYS) * Math.PI * 2} width={110} height={1100} alpha={i % 2 ? 0.06 : 0.13} blendMode="add" />
			{/each}
		</Container>
		<Sprite key="fx_glow" anchor={0.5} width={1200} height={760} alpha={0.32} blendMode="add" />
		<Container y={-70} scale={punch.current}>
			<Sprite key={`banner_${banner}`} anchor={0.5} width={BANNER.w} height={BANNER.h} />
		</Container>
		<CounterText text={bookMoney(count.current, amount)} size={104} y={95} style={{ stroke: { color: COLOR.goldShadow, width: 5 } }} />
		<Text anchor={0.5} y={235} text={counting ? text.tapToSkip : text.tapToContinue} style={textStyle.caption(20)} />
	</Container>
	<PressToContinue showText={false} onpress={() => (counting ? skip() : close())} />
{/if}
