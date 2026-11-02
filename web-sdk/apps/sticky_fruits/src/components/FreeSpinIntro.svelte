<script lang="ts" module>
	export type EmitterEventFreeSpinIntro = { type: 'freeSpinIntro'; totalFreeSpins: number; auto: boolean };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { waitForResolve } from 'utils-shared/wait';

	import Panel from './Panel.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { getContext } from '../game/context';
	import { holdSpace } from '../ui/keyGate.svelte';
	import { COLOR, textStyle } from '../game/theme';
	import { copyNow } from '../i18n/copy';
	import { wait } from '../motion/loop';

	// "The Private Room": announces the free spins and the sticky-chip rule; tap to start
	// (autoplay continues on its own after a moment).
	const context = getContext();
	let visible = $state(false);
	let spins = $state(0);
	let start = () => {};
	const fade = new Tween(0, { duration: 300, easing: cubicOut });
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const text = $derived(copyNow());

	context.eventEmitter.subscribeOnMount({
		freeSpinIntro: async ({ totalFreeSpins, auto }) => {
			const releaseSpace = holdSpace();
			spins = totalFreeSpins;
			visible = true;
			fade.target = 1;
			await Promise.race([waitForResolve((resolve) => (start = () => resolve(undefined))), ...(auto ? [wait(2600)] : [])]);
			await fade.set(0);
			visible = false;
			releaseSpace();
		},
	});
</script>

{#if visible}
	<Container alpha={fade.current}>
		<Rectangle width={canvas.width} height={canvas.height} backgroundColor={COLOR.black} backgroundAlpha={0.55} />
		<Panel footer={text.tapToStart}>
			<Text anchor={0.5} y={-128} text={text.privateRoom} style={textStyle.caption(22)} />
			<Text anchor={0.5} y={-40} text={String(spins)} style={textStyle.display(120)} />
			<Text anchor={0.5} y={46} text={text.freeSpins} style={textStyle.display(40)} />
			<Text anchor={0.5} y={104} text={text.wildsStay} style={textStyle.body(19)} />
		</Panel>
	</Container>
	<PressToContinue showText={false} onpress={() => start()} />
{/if}
