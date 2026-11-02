<script lang="ts" module>
	export type EmitterEventFreeSpinOutro = { type: 'freeSpinOutro'; amount: number; fast: boolean; auto: boolean };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { waitForResolve } from 'utils-shared/wait';

	import Panel from './Panel.svelte';
	import CounterText from './CounterText.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { getContext } from '../game/context';
	import { holdSpace } from '../ui/keyGate.svelte';
	import { bookMoney } from '../game/money';
	import { COLOR, textStyle } from '../game/theme';
	import { copyNow } from '../i18n/copy';
	import { countUpMs, isTakeover, tierForAmount } from '../presentation/winTiers';
	import { wait } from '../motion/loop';

	// "Bonus complete": the free-spin total. If a takeover already celebrated it, the amount is shown
	// settled; otherwise it counts up here.
	const context = getContext();
	let visible = $state(false);
	let next = () => {};
	const count = new Tween(0);
	const fade = new Tween(0, { duration: 300, easing: cubicOut });
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const text = $derived(copyNow());
	let gold = $state(false);
	let target = $state(0);

	context.eventEmitter.subscribeOnMount({
		freeSpinOutro: async ({ amount, fast, auto }) => {
			const releaseSpace = holdSpace();
			const tier = tierForAmount(amount);
			gold = amount > 100;
			target = amount;
			await count.set(isTakeover(tier) ? amount : 0, { duration: 0 });
			visible = true;
			fade.target = 1;
			await count.set(amount, { duration: isTakeover(tier) ? 0 : countUpMs(tier, { fast }), easing: cubicOut });
			await Promise.race([
				waitForResolve((resolve) => (next = () => resolve(undefined))),
				...(auto || fast ? [wait(1800)] : [wait(6000)]),
			]);
			await fade.set(0);
			visible = false;
			releaseSpace();
		},
	});
</script>

{#if visible}
	<Container alpha={fade.current}>
		<Rectangle width={canvas.width} height={canvas.height} backgroundColor={COLOR.black} backgroundAlpha={0.55} />
		<Panel footer={text.tapToContinue}>
			<Text anchor={0.5} y={-120} text={text.bonusComplete} style={textStyle.display(40)} />
			<Text anchor={0.5} y={-62} text={text.bonusWin} style={textStyle.caption(18)} />
			<CounterText text={bookMoney(count.current, target)} size={78} y={14} style={gold ? { fill: COLOR.gold } : {}} />
		</Panel>
	</Container>
	<PressToContinue showText={false} onpress={() => next()} />
{/if}
