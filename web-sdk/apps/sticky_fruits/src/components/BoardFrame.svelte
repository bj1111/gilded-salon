<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';

	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { ART_GEOMETRY } from '../game/artAssets';
	import { BOARD_SIZES } from '../game/constants';
	import BoardContainer from './BoardContainer.svelte';
	import Crest from './Crest.svelte';

	// The table: emerald felt under the reels, the fluted brass frame around them, and the crest
	// with the logo plaque on top. During free spins a warm glow sits behind the frame.
	const context = getContext();
	const frame = ART_GEOMETRY.frame;
	const glow = new Tween(0, { duration: 600 });

	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => (glow.target = 1),
		boardFrameGlowHide: () => (glow.target = 0),
	});
</script>

<BoardContainer>
	<Sprite
		key="fx_glow"
		anchor={0.5}
		x={BOARD_SIZES.width / 2}
		y={BOARD_SIZES.height / 2}
		width={frame.w * 1.45}
		height={frame.h * 1.6}
		alpha={glow.current * 0.55}
	/>
	<Sprite key="felt" width={BOARD_SIZES.width} height={BOARD_SIZES.height} />
	<Sprite key="frame" x={-frame.boardX} y={-frame.boardY} width={frame.w} height={frame.h} />
</BoardContainer>

<Crest />
