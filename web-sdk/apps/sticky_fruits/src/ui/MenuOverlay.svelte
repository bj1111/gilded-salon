<script lang="ts">
	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { stateModal, stateSound, stateUi } from 'state-shared';

	import RoundButton from './RoundButton.svelte';
	import type { Layout } from './layout';
	import { getContext } from '../game/context';
	import { COLOR, textStyle } from '../game/theme';
	import { copyNow } from '../i18n/copy';

	// The menu: game info (paytable), rules, settings, sound and close, as a lacquer card in the
	// middle of the screen. Tapping outside closes it.
	type Props = { layout: Layout };

	const props: Props = $props();
	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const text = $derived(copyNow());
	const muted = $derived(stateSound.volumeValueMaster === 0);

	const press = () => context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
	const open = (name: 'payTable' | 'gameRules' | 'settings') => {
		press();
		stateUi.menuOpen = false;
		stateModal.modal = { name };
	};
	const toggleSound = () => {
		press();
		stateSound.volumeValueMaster = muted ? 50 : 0;
	};
	const close = () => {
		press();
		stateUi.menuOpen = false;
	};

	const items = $derived([
		{ icon: 'icon_info', label: text.payTableTitle, onpress: () => open('payTable') },
		{ icon: 'icon_rules', label: text.rulesTitle, onpress: () => open('gameRules') },
		{ icon: 'icon_settings', label: text.settings, onpress: () => open('settings') },
		{ icon: muted ? 'icon_soundOff' : 'icon_sound', label: muted ? text.soundOff : text.soundOn, onpress: toggleSound },
		{ icon: 'icon_close', label: text.close, onpress: close },
	]);

	// card in design units, scaled to fit whatever the screen allows
	const ROW = 110;
	const CARD = { w: 460, h: ROW * 5 + 50 };
	const s = $derived(Math.min(props.layout.u * 1.1, (canvas.height * 0.9) / CARD.h, (canvas.width * 0.9) / CARD.w));
</script>

<Rectangle
	eventMode="static"
	cursor="pointer"
	width={canvas.width}
	height={canvas.height}
	backgroundColor={COLOR.black}
	backgroundAlpha={0.6}
	onpointerup={close}
/>
<Container x={canvas.width / 2} y={canvas.height / 2} scale={s}>
	<Rectangle
		eventMode="static"
		anchor={0.5}
		width={CARD.w}
		height={CARD.h}
		borderRadius={18}
		backgroundColor={COLOR.lacquer}
		backgroundAlpha={0.96}
		borderColor={COLOR.goldMid}
		borderWidth={3}
	/>
	{#each items as item, i (item.icon + i)}
		{@const y = -CARD.h / 2 + 25 + ROW * (i + 0.5)}
		<RoundButton at={{ x: -CARD.w / 2 + 80, y, w: 84, h: 84, scale: 1 }} icon={item.icon} onpress={item.onpress} />
		<Text anchor={{ x: 0, y: 0.5 }} x={-CARD.w / 2 + 145} y={y + 3} text={item.label} style={textStyle.caption(22, { fill: COLOR.ivory })} />
	{/each}
</Container>
