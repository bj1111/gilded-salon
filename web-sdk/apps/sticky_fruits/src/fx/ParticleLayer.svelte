<script lang="ts" module>
	import type { EmitOptions } from './particleSim';

	// Positions are canvas pixels; `scale` multiplies sprite size and speeds (pass the layout's u).
	export type EmitterEventFx =
		| { type: 'fxBurst'; burst: EmitOptions & { scale?: [number, number] }; unit?: number }
		| { type: 'fxClear' };
</script>

<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';

	import { getContextParent } from 'pixi-svelte';

	import { createParticleSim } from './particleSim';
	import { getContext } from '../game/context';

	// Chip showers and glint bursts, drawn straight on the Pixi ticker from a fixed sprite pool so a
	// MEGA WIN costs no allocations or Svelte updates per frame.
	const MAX = 140;
	const SIZE = { chip: 52, glint: 40 };
	const context = getContext();
	const parent = getContextParent();
	const sim = createParticleSim(MAX);
	const layer = new PIXI.Container();
	const sprites: PIXI.Sprite[] = [];

	context.eventEmitter.subscribeOnMount({
		// `unit` (px per design unit) scales size, speed and gravity so bursts look the same on any screen
		fxBurst: ({ burst, unit = 1 }) => {
			const [s0, s1] = burst.scale ?? [0.7, 1.1];
			const [v0, v1] = burst.speed ?? [0.25, 0.7];
			sim.emit({
				...burst,
				scale: [s0 * unit, s1 * unit],
				speed: [v0 * unit, v1 * unit],
				gravity: (burst.gravity ?? 0.0012) * unit,
			});
		},
		fxClear: () => sim.clear(),
	});

	onMount(() => {
		parent.parent.addChild(layer);
		const textures = {
			chip: context.stateApp.loadedAssets['fx_chip'] as PIXI.Texture,
			glint: context.stateApp.loadedAssets['fx_glint'] as PIXI.Texture,
		};
		for (let i = 0; i < MAX; i++) {
			const sprite = new PIXI.Sprite(textures.chip);
			sprite.anchor.set(0.5);
			sprite.visible = false;
			layer.addChild(sprite);
			sprites.push(sprite);
		}

		const tick = (ticker: PIXI.Ticker) => {
			sim.step(Math.min(50, ticker.deltaMS));
			const particles = sim.particles;
			for (let i = 0; i < MAX; i++) {
				const sprite = sprites[i];
				const p = particles[i];
				if (!p) {
					sprite.visible = false;
					continue;
				}
				const size = SIZE[p.kind] * p.scale;
				sprite.visible = true;
				sprite.texture = textures[p.kind];
				sprite.blendMode = p.kind === 'glint' ? 'add' : 'normal';
				sprite.x = p.x;
				sprite.y = p.y;
				sprite.rotation = p.rotation;
				sprite.alpha = p.alpha;
				sprite.width = size;
				// chips tumble: squash vertically like a coin flipping through the air
				sprite.height = p.kind === 'chip' ? size * Math.max(0.15, Math.abs(Math.cos(p.flip))) : size;
			}
		};
		const ticker = context.stateApp.pixiApplication?.ticker ?? PIXI.Ticker.shared;
		ticker.add(tick);

		return () => {
			ticker.remove(tick);
			sim.clear();
			layer.destroy({ children: true });
		};
	});
</script>
