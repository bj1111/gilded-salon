<script lang="ts">
	import { onMount } from 'svelte';

	import { stateModal } from 'state-shared';

	import { stateApp } from '../game/stateApp';
	import { stateLayout } from '../game/stateLayout';
	import { loadFonts } from '../game/fonts';
	import { audio } from '../audio';
	import { copyNow } from '../i18n/copy';
	import { keyGate } from '../ui/keyGate.svelte';

	// The first thing the player sees (plain HTML, so it paints before any script-heavy work):
	// the sunburst crest draws itself, the gold line tracks real asset loading, then TAP TO ENTER.
	// The tap unlocks audio and the two lacquer doors part onto the salon.
	let fontsReady = $state(false);
	let opening = $state(false);
	let gone = $state(false);
	const progress = $derived(stateApp.loaded ? 100 : Math.max(4, stateApp.loadingProgress));
	const ready = $derived(stateApp.loaded && fontsReady);
	const text = $derived(copyNow());
	// an error modal must stay visible above the loader
	const hidden = $derived(stateModal.modal?.name === 'error');

	onMount(async () => {
		await loadFonts();
		fontsReady = true;
	});

	const enter = () => {
		if (!ready || opening) return;
		audio.unlock();
		audio.play('doorsOpen');
		opening = true;
		stateLayout.showLoadingScreen = false;
		setTimeout(() => (gone = true), 1300);
	};

	const onkeydown = (event: KeyboardEvent) => {
		if (event.repeat || gone || opening) return;
		if (event.code === 'Space' || event.code === 'Enter') {
			// the same key press must not also spin once the game appears
			if (event.code === 'Space') keyGate.spaceReleased = false;
			enter();
		}
	};
	const onkeyup = (event: KeyboardEvent) => {
		if (event.code === 'Space') keyGate.spaceReleased = true;
	};

	const rays = Array.from({ length: 13 }, (_, i) => {
		const a = Math.PI + (i / 12) * Math.PI;
		return { x2: 100 + 92 * Math.cos(a), y2: 100 + 92 * Math.sin(a), wide: i % 2 === 0 };
	});
</script>

<svelte:window {onkeydown} {onkeyup} />

{#if !gone && !hidden}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="loader" class:opening role="button" tabindex="0" aria-label={text.tapToEnter} onclick={enter}>
		<div class="door left"></div>
		<div class="door right"></div>
		<div class="content">
			<svg class="crest" viewBox="0 0 200 104" aria-hidden="true">
				<defs>
					<linearGradient id="loaderGold" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stop-color="#FFF4CF" /><stop offset=".5" stop-color="#C99A45" /><stop offset="1" stop-color="#8C6A2E" />
					</linearGradient>
				</defs>
				{#each rays as ray, i (i)}
					<line x1="100" y1="100" x2={ray.x2} y2={ray.y2} stroke="url(#loaderGold)" stroke-width={ray.wide ? 1.6 : 0.8} style="animation-delay:{i * 60}ms" />
				{/each}
				<path d="M 8 100 A 92 92 0 0 1 192 100" fill="none" stroke="url(#loaderGold)" stroke-width="1.6" />
				<path d="M 34 100 A 66 66 0 0 1 166 100" fill="none" stroke="url(#loaderGold)" stroke-width="0.9" />
			</svg>
			<h1>GILDED SALON</h1>
			<div class="tagline">MONTE CARLO · 1928</div>
			<div class="track" aria-hidden="true"><div class="bar" style="width:{progress}%"></div></div>
			<div class="prompt" class:show={ready}>{ready ? text.tapToEnter : text.loading}</div>
		</div>
	</div>
{/if}

<style>
	.loader {
		position: fixed;
		inset: 0;
		z-index: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(ellipse at 50% 40%, #1a1c21 0%, #0b0c0e 70%);
		cursor: pointer;
		overflow: hidden;
		outline: none;
		font-family: 'Josefin Sans', 'Helvetica Neue', Arial, sans-serif;
	}
	.loader.opening {
		background: transparent;
		pointer-events: none;
	}
	.door {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 50.5%;
		background: linear-gradient(180deg, #16171b, #0b0c0e);
		transition: transform 1.1s cubic-bezier(0.7, 0, 0.3, 1);
	}
	.door.left {
		left: 0;
	}
	.door.right {
		right: 0;
	}
	/* the gold seam only shows once the doors start to part */
	.opening .door.left {
		border-right: 2px solid #c99a45;
	}
	.opening .door.right {
		border-left: 2px solid #c99a45;
	}
	.opening .door.left {
		transform: translateX(-100%);
	}
	.opening .door.right {
		transform: translateX(100%);
	}
	.content {
		position: relative;
		text-align: center;
		width: min(86vw, 560px);
		transition: opacity 0.35s ease;
	}
	.opening .content {
		opacity: 0;
	}
	.crest {
		width: min(60vw, 300px);
		height: auto;
		display: block;
		margin: 0 auto;
	}
	.crest line {
		stroke-dasharray: 100;
		stroke-dashoffset: 100;
		animation: draw 0.9s ease-out forwards;
	}
	.crest path {
		stroke-dasharray: 300;
		stroke-dashoffset: 300;
		animation: draw 1.4s ease-out 0.3s forwards;
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	h1 {
		margin: 0.2em 0 0;
		font-family: 'Limelight', Georgia, serif;
		font-weight: 400;
		font-size: clamp(26px, 7vw, 56px);
		letter-spacing: 0.12em;
		background: linear-gradient(180deg, #fff4cf 0%, #f0d592 30%, #c99a45 60%, #8c6a2e 100%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.tagline {
		margin-top: 0.5em;
		color: #c99a45;
		font-weight: 700;
		font-size: clamp(9px, 1.6vw, 13px);
		letter-spacing: 0.5em;
	}
	.track {
		margin: clamp(16px, 4vh, 36px) auto 0;
		width: min(70vw, 360px);
		height: 2px;
		background: rgba(201, 154, 69, 0.25);
	}
	.bar {
		height: 100%;
		background: linear-gradient(90deg, #8c6a2e, #fff4cf);
		box-shadow: 0 0 8px rgba(240, 213, 146, 0.8);
		transition: width 0.3s ease;
	}
	.prompt {
		margin-top: clamp(12px, 3vh, 26px);
		color: #b9ad94;
		font-weight: 700;
		font-size: clamp(11px, 2vw, 16px);
		letter-spacing: 0.4em;
		min-height: 1.4em;
	}
	.prompt.show {
		color: #f5ecd9;
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
</style>
