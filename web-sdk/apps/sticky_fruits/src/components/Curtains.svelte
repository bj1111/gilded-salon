<script lang="ts" module>
	export type EmitterEventCurtains =
		| { type: 'curtainsClose' }
		| { type: 'curtainsOpen' }
		// resume: put the drapes in place without animating
		| { type: 'curtainsSet'; closed: boolean };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';

	import { Container, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { ART_GEOMETRY } from '../game/artAssets';

	// Rouge velvet drapes and a valance that close over the salon windows for free spins.
	const context = getContext();
	const CURTAIN = ART_GEOMETRY.sizes.curtain;
	const VALANCE = ART_GEOMETRY.sizes.valance;
	const closed = new Tween(context.stateGame.gameType === 'freegame' ? 1 : 0, { duration: 950, easing: cubicInOut });
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	// each drape covers this share of the screen width when drawn
	const cover = $derived(canvas.width / canvas.height < 1 ? 0.2 : 0.24);
	const height = $derived(canvas.height);
	const width = $derived(Math.max(canvas.width * cover, height * (CURTAIN.w / CURTAIN.h) * 0.6));
	const valanceH = $derived(Math.min(canvas.height * 0.09, (canvas.width / VALANCE.w) * VALANCE.h * 1.6));

	context.eventEmitter.subscribeOnMount({
		curtainsClose: () => closed.set(1),
		curtainsOpen: () => closed.set(0),
		curtainsSet: ({ closed: isClosed }) => closed.set(isClosed ? 1 : 0, { duration: 0 }),
	});
</script>

<!-- created only while drawn, so its layer is pinned: above the salon (-2), below table and HUD (0) -->
{#if closed.current > 0.001}
	<Container zIndex={-1}>
		<Sprite key="curtain" x={-width + width * closed.current} y={0} width={width} height={height} />
		<!-- the right drape is the left one mirrored -->
		<Container x={canvas.width + width - width * closed.current} scale={{ x: -1, y: 1 }}>
			<Sprite key="curtain" width={width} height={height} />
		</Container>
		<Sprite key="valance" x={0} y={-valanceH + valanceH * closed.current} width={canvas.width} height={valanceH} />
	</Container>
{/if}
