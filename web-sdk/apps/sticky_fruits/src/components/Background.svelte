<script lang="ts">
	import { Container, Rectangle, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';

	import { getContext } from '../game/context';
	import { ART_GEOMETRY } from '../game/artAssets';
	import { COLOR } from '../game/theme';
	import SalonLights from './SalonLights.svelte';

	// The salon behind the table. Portrait art on tall screens, landscape art otherwise; both are
	// scaled to cover the canvas. Free spins cross-fade to the private room (lights down).
	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const tall = $derived(canvas.width / canvas.height < 1);
	const art = $derived(tall ? ART_GEOMETRY.bg.portrait : ART_GEOMETRY.bg.landscape);
	const cover = $derived.by(() => {
		const scale = Math.max(canvas.width / art.w, canvas.height / art.h);
		return { scale, x: (canvas.width - art.w * scale) / 2, y: (canvas.height - art.h * scale) / 2 };
	});
	const freegame = $derived(context.stateGame.gameType === 'freegame');
</script>

<Rectangle {...canvas} backgroundColor={COLOR.lacquer} zIndex={-3} />

<Container x={cover.x} y={cover.y} scale={cover.scale} zIndex={-2}>
	<Sprite key={tall ? 'bg_salon_p' : 'bg_salon'} width={art.w} height={art.h} />
	<SalonLights lights={art.lights} glints={art.glints} dimmed={freegame} />
	<FadeContainer show={freegame} duration={900}>
		<Sprite key={tall ? 'bg_private_p' : 'bg_private'} width={art.w} height={art.h} />
	</FadeContainer>
</Container>
