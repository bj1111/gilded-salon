<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Rectangle, Sprite, Text } from 'pixi-svelte';
	import { Button } from 'components-pixi';
	import { stateBet, stateBetDerived, stateConfig, stateMeta } from 'state-shared';

	import BuyCard from './BuyCard.svelte';
	import { stateBuy } from './stateBuy.svelte';
	import { startBuy, setHunt } from './buyFlow';
	import { buyPrice, canAfford, huntActive, type BuyMode } from './buyRules';
	import RoundButton from '../ui/RoundButton.svelte';
	import { nextBet } from '../ui/betSteps';
	import { holdSpace } from '../ui/keyGate.svelte';
	import { getContext } from '../game/context';
	import { money } from '../game/money';
	import { COLOR, textStyle } from '../game/theme';
	import { copyNow } from '../i18n/copy';

	// "The Cashier": the three bought features, the bet they are priced at, and a confirm step for
	// every buy. Bonus Hunt is a switch (no money moves until the next spin, priced on the BET field).
	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const text = $derived(copyNow());
	const wide = $derived(canvas.width < canvas.height);
	const hunt = $derived(huntActive(stateBet.activeBetModeKey));
	const press = () => context.eventEmitter.broadcast({ type: 'soundPressGeneral' });

	const cost = (mode: BuyMode) => stateMeta.betModeMeta[mode]?.costMultiplier ?? 0;
	const afford = (mode: BuyMode) => canAfford(cost(mode), stateBet.betAmount, stateBet.balanceAmount);
	// the price in the player's currency at the current bet (Bonus Hunt: per spin)
	const priceText = (mode: BuyMode) => {
		const price = money(buyPrice(cost(mode), stateBet.betAmount));
		return mode === 'HUNT' ? text.perSpin(price) : price;
	};

	const options = $derived(
		(
			[
				{ mode: 'BONUS', icon: 'sym_S', name: text.bonusName, description: text.bonusDesc },
				{ mode: 'SUPER', icon: 'icon_highroller', name: text.superName, description: text.superDesc },
				{ mode: 'HUNT', icon: 'icon_hunt', name: text.huntName, description: text.huntDesc },
			] as const
		).filter((option) => cost(option.mode) > 0),
	);

	const levels = $derived(stateConfig.betAmountOptions);
	const stepBet = (direction: 1 | -1) => {
		press();
		stateBetDerived.setBetAmount(nextBet(levels, stateBet.betAmount, direction));
	};

	const close = () => {
		press();
		stateBuy.confirming = null;
		stateBuy.open = false;
	};

	const choose = (mode: BuyMode) => {
		press();
		if (mode === 'HUNT') {
			setHunt(!hunt, (key) => (stateBet.activeBetModeKey = key));
			stateBuy.open = false;
			return;
		}
		stateBuy.confirming = mode;
	};

	const confirm = () => {
		const mode = stateBuy.confirming;
		if (!mode) return;
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		const started = startBuy(mode, {
			cost: cost(mode),
			bet: stateBet.betAmount,
			balance: stateBet.balanceAmount,
			setMode: (key) => (stateBet.activeBetModeKey = key),
			clearConfirm: () => (stateBuy.confirming = null),
			broadcastBet: () => context.eventEmitter.broadcast({ type: 'bet' }),
		});
		if (started) stateBuy.open = false;
	};

	const back = () => {
		press();
		stateBuy.confirming = null;
	};

	onMount(() => {
		const release = holdSpace();
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			if (stateBuy.confirming) back();
			else close();
		};
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('keydown', onKey);
			release();
		};
	});

	// menu in design units, scaled to fit the screen
	const box = $derived(wide ? { w: 700, h: 1160 } : { w: 1240, h: 740 });
	const s = $derived(Math.min((canvas.width * 0.96) / box.w, (canvas.height * 0.94) / box.h));
	const top = $derived(-box.h / 2);
	const cardAt = (i: number) => (wide ? { x: 0, y: top + 330 + i * 270 } : { x: (i - 1) * 400, y: top + 450 });
	const confirming = $derived(options.find((option) => option.mode === stateBuy.confirming));
</script>

<Rectangle
	eventMode="static"
	cursor="pointer"
	width={canvas.width}
	height={canvas.height}
	backgroundColor={COLOR.black}
	backgroundAlpha={0.72}
	onpointerup={close}
/>
<Container x={canvas.width / 2} y={canvas.height / 2} scale={s}>
	<!-- swallow taps on the menu itself so only the backdrop closes it -->
	<Rectangle eventMode="static" x={-box.w / 2} y={top} width={box.w} height={box.h} backgroundAlpha={0} />
	<Text anchor={0.5} y={top + 40} text={text.menuTitle} style={textStyle.display(48)} />
	<RoundButton at={{ x: box.w / 2 - 40, y: top + 40, w: 72, h: 72, scale: 1 }} icon="icon_close" onpress={close} />

	<!-- the bet every price is quoted at -->
	<Text anchor={0.5} y={top + 112} text={text.bet} style={textStyle.caption(18)} />
	<RoundButton
		at={{ x: -190, y: top + 152, w: 64, h: 64, scale: 1 }}
		icon="icon_minus"
		onpress={() => stepBet(-1)}
		disabled={stateBet.betAmount <= Math.min(...levels)}
	/>
	<Text anchor={0.5} y={top + 154} text={money(stateBet.betAmount)} style={textStyle.value(36)} />
	<RoundButton
		at={{ x: 190, y: top + 152, w: 64, h: 64, scale: 1 }}
		icon="icon_plus"
		onpress={() => stepBet(1)}
		disabled={stateBet.betAmount >= Math.max(...levels)}
	/>

	{#each options as option, i (option.mode)}
		{@const p = cardAt(i)}
		{@const isHunt = option.mode === 'HUNT'}
		<BuyCard
			x={p.x}
			y={p.y}
			{wide}
			icon={option.icon}
			name={option.name}
			description={option.description}
			price={priceText(option.mode)}
			action={isHunt ? (hunt ? text.turnOff : text.turnOn) : text.buyAction}
			affordable={(isHunt && hunt) || afford(option.mode)}
			tooLow={text.tooLow}
			active={isHunt && hunt}
			onpress={() => choose(option.mode)}
		/>
	{/each}

	{#if confirming}
		<Rectangle eventMode="static" x={-box.w / 2} y={top} width={box.w} height={box.h} backgroundColor={COLOR.black} backgroundAlpha={0.6} />
		<Sprite key="panel" anchor={0.5} width={620} height={340} />
		<Text
			anchor={0.5}
			y={-50}
			text={text.confirmBuy(confirming.name, money(buyPrice(cost(confirming.mode), stateBet.betAmount)))}
			style={textStyle.body(30, { align: 'center', wordWrap: true, wordWrapWidth: 520, lineHeight: 40 })}
		/>
		{#each [{ x: -135, label: text.confirm, key: 'btn_buy', onpress: confirm, fill: COLOR.lacquer }, { x: 135, label: text.back, key: 'plaque', onpress: back, fill: COLOR.ivory }] as b (b.label)}
			<Container x={b.x} y={80}>
				<Button sizes={{ width: 230, height: 76 }} anchor={0.5} onpress={b.onpress}>
					{#snippet children({ center, hovered, pressed })}
						<Container {...center} scale={pressed ? 0.94 : hovered ? 1.04 : 1}>
							<Sprite key={b.key} anchor={0.5} width={230} height={76} />
							<Text anchor={0.5} x={b.key === 'btn_buy' ? 18 : 0} y={1} text={b.label} style={textStyle.display(24, { fill: b.fill, dropShadow: false })} />
						</Container>
					{/snippet}
				</Button>
			</Container>
		{/each}
	{/if}
</Container>
