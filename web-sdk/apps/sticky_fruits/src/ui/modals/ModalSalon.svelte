<script lang="ts" module>
	let nextId = 0;
</script>

<script lang="ts">
	// Gilded Salon modal shell + content renderer, shared by ModalPayTable and ModalRules.
	// Same mechanics as the SDK <Popup> (components-shared): fixed overlay at zIndex.modal,
	// Escape / backdrop / × close, clicks ignored for the first 300 ms so the tap that opened the
	// modal can't close it. Unlike <Popup> it renders its content once and owns its close button,
	// so the close target stays large at every size.
	import { onMount, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';

	import { zIndex } from 'constants-shared/zIndex';
	import { stateBet } from 'state-shared';
	import { money as numberToCurrencyString } from '../../game/money';

	import artAssets from '../../game/artAssets';
	import { copy } from '../../i18n/copyData';
	import { formatMultiplier, type ModalContent } from './content';

	type Props = {
		content: ModalContent;
		social: boolean;
		onclose: () => void;
		version?: Snippet;
	};

	const props: Props = $props();
	const c = $derived(copy(props.social));
	const titleId = `salon-modal-title-${nextId++}`;

	const CLICK_GUARD_MS = 300;
	let ready = $state(false);
	let panel = $state<HTMLElement | null>(null);

	const close = () => {
		if (ready) props.onclose();
	};

	const amount = (multiplier: number) => numberToCurrencyString(stateBet.betAmount * multiplier);

	// payline diagram geometry (viewBox 0 0 50 30: 5 reels x 3 rows of 10-unit cells)
	const CELL = 10;
	const REELS = [0, 1, 2, 3, 4];
	const ROWS = [0, 1, 2];
	const points = (rows: readonly number[]) =>
		rows.map((row, reel) => `${reel * CELL + CELL / 2},${row * CELL + CELL / 2}`).join(' ');

	onMount(() => {
		panel?.focus({ preventScroll: true });
		const timer = setTimeout(() => (ready = true), CLICK_GUARD_MS);
		return () => clearTimeout(timer);
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') close();
	}}
/>

<div class="salon-modal" style:z-index={zIndex.modal} in:fade={{ duration: 180 }}>
	<div class="backdrop" role="presentation" onclick={close}></div>

	<div
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
		tabindex="-1"
		bind:this={panel}
	>
		<header class="head">
			<div class="titles">
				<span class="eyebrow">{c.gameName}</span>
				<h2 id={titleId} class="title">{props.content.title}</h2>
			</div>
			<button class="close" type="button" aria-label={c.close} title={c.close} onclick={close}>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M5 5 L19 19 M19 5 L5 19" />
				</svg>
			</button>
		</header>

		<div class="body">
			{#each props.content.sections as section (section.id)}
				<section class="section">
					<h3 class="heading"><span>{section.heading}</span></h3>

					{#each section.blocks as block, blockIndex (blockIndex)}
						{#if block.type === 'paragraph'}
							<p class="text" class:disclaimer={block.tone === 'disclaimer'}>{block.text}</p>
						{:else if block.type === 'amountNote'}
							<p class="note">{c.paysShownAt(numberToCurrencyString(stateBet.betAmount))}</p>
						{:else if block.type === 'list'}
							<ul class="list">
								{#each block.items as item}
									<li>{item}</li>
								{/each}
							</ul>
						{:else if block.type === 'table'}
							<table class="table">
								<thead>
									<tr>
										{#each block.head as cell}
											<th scope="col">{cell}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each block.rows as row}
										<tr>
											{#each row as cell}
												<td>{cell}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						{:else if block.type === 'controls'}
							<dl class="controls">
								{#each block.items as item}
									<dt>{item.control}</dt>
									<dd>{item.text}</dd>
								{/each}
							</dl>
						{:else if block.type === 'symbols'}
							<ul class="symbols">
								{#each block.symbols as symbol (symbol.key)}
									<li
										class="symbol"
										class:special={!!symbol.role}
										class:scatter={symbol.key === 'S'}
									>
										<img
											class="art"
											src={artAssets[symbol.art].src}
											alt=""
											draggable="false"
											loading="lazy"
										/>
										<div class="symbol-body">
											<div class="symbol-name">
												<span>{symbol.name}</span>
												{#if symbol.role}<span class="role">{symbol.role}</span>{/if}
											</div>
											{#if symbol.pays.length > 0}
												<table class="pays">
													<tbody>
														{#each symbol.pays as pay (pay.count)}
															<tr>
																<th scope="row" aria-label={c.ofAKind(pay.count)}>{pay.count}</th>
																<td class="mult">
																	{formatMultiplier(pay.multiplier).slice(0, -1)}<span class="times">×</span>
																</td>
																{#if block.showAmounts}
																	<td class="amount">{amount(pay.multiplier)}</td>
																{/if}
															</tr>
														{/each}
													</tbody>
												</table>
											{/if}
											{#if symbol.description}
												<p class="desc">{symbol.description}</p>
											{/if}
										</div>
									</li>
								{/each}
							</ul>
						{:else if block.type === 'paylines'}
							<ol class="paylines">
								{#each block.lines as line (line.number)}
									<li class="payline">
										<span class="line-number" aria-hidden="true">{line.number}</span>
										<svg
											viewBox="0 0 {REELS.length * CELL} {ROWS.length * CELL}"
											role="img"
											aria-label="{block.label} {line.number}"
										>
											{#each REELS as reel}
												{#each ROWS as row}
													<rect
														class="cell"
														class:on={line.rows[reel] === row}
														x={reel * CELL + 0.75}
														y={row * CELL + 0.75}
														width={CELL - 1.5}
														height={CELL - 1.5}
														rx="1"
													/>
												{/each}
											{/each}
											<polyline class="trace" points={points(line.rows)} />
										</svg>
									</li>
								{/each}
							</ol>
						{/if}
					{/each}
				</section>
			{/each}

			{#if props.version}
				<footer class="version">{@render props.version()}</footer>
			{/if}
		</div>
	</div>
</div>

<style>
	.salon-modal {
		--lacquer: #0b0c0e;
		--lacquer-2: #15171b;
		--lacquer-3: #1a1c21;
		--gold: #d4af62;
		--gold-light: #f0d592;
		--gold-deep: #8c6a2e;
		--ivory: #f5ecd9;
		--rouge: #b3122e;
		--hairline: rgba(212, 175, 98, 0.35);
		--display: 'Limelight', Georgia, serif;
		--body: 'Josefin Sans', 'Helvetica Neue', Arial, sans-serif;
		--pad: clamp(10px, 2.2vw, 28px);

		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: max(6px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right))
			max(6px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left));
		box-sizing: border-box;
		font-family: var(--body);
		font-size: clamp(14px, 0.25vw + 13px, 17px);
		line-height: 1.5;
		color: var(--ivory);
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.salon-modal *,
	.salon-modal *::before,
	.salon-modal *::after {
		box-sizing: border-box;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at center, rgba(11, 12, 14, 0.72), rgba(5, 6, 7, 0.92));
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
	}

	/* ---------- panel: lacquer with a double gold hairline and stepped deco corners ---------- */

	.panel {
		position: relative;
		display: flex;
		flex-direction: column;
		width: min(980px, 100%);
		max-height: 100%;
		min-height: 0;
		background: linear-gradient(180deg, var(--lacquer-2) 0%, var(--lacquer) 100%);
		border: 1px solid var(--gold);
		box-shadow:
			inset 0 0 0 4px var(--lacquer),
			inset 0 0 0 5px var(--hairline),
			0 24px 80px rgba(0, 0, 0, 0.65);
		outline: none;
	}

	.panel::before,
	.panel::after {
		content: '';
		position: absolute;
		width: 18px;
		height: 18px;
		pointer-events: none;
		border: 1px solid var(--gold-light);
	}

	.panel::before {
		top: 8px;
		left: 8px;
		border-right: 0;
		border-bottom: 0;
	}

	.panel::after {
		bottom: 8px;
		right: 8px;
		border-left: 0;
		border-top: 0;
	}

	/* ---------- header ---------- */

	.head {
		flex: none;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 10px 8px var(--pad);
		margin: 0 6px;
		border-bottom: 1px solid var(--hairline);
	}

	.titles {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-left: 52px; /* balances the close button so the title stays centred */
	}

	.eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.32em;
		color: var(--gold);
	}

	.title {
		margin: 0;
		font-family: var(--display);
		font-weight: 400;
		font-size: clamp(20px, 1.1vw + 14px, 32px);
		line-height: 1.15;
		letter-spacing: 0.08em;
		text-align: center;
		color: var(--gold-light);
		overflow-wrap: anywhere;
	}

	.close {
		flex: none;
		width: 52px;
		height: 52px;
		display: grid;
		place-items: center;
		padding: 0;
		background: transparent;
		border: 1px solid var(--gold);
		border-radius: 50%;
		color: var(--gold-light);
		cursor: pointer;
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}

	.close svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	.close:hover,
	.close:focus-visible {
		background: rgba(212, 175, 98, 0.16);
		color: var(--ivory);
		outline: none;
	}

	/* ---------- scrolling body ---------- */

	.body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		touch-action: pan-y;
		padding: 4px var(--pad) var(--pad);
		margin: 0 6px 6px;
		scrollbar-width: thin;
		scrollbar-color: var(--gold-deep) transparent;
		overflow-wrap: break-word;
	}

	.body::-webkit-scrollbar {
		width: 6px;
	}

	.body::-webkit-scrollbar-thumb {
		background: var(--gold-deep);
		border-radius: 3px;
	}

	.section {
		margin-top: clamp(14px, 2vw, 26px);
	}

	.heading {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0 0 12px;
		font-family: var(--display);
		font-weight: 400;
		font-size: clamp(15px, 0.6vw + 12px, 22px);
		letter-spacing: 0.1em;
		line-height: 1.2;
		color: var(--gold);
	}

	.heading span {
		flex: 0 1 auto;
		min-width: 0;
		text-align: center;
	}

	.heading::before,
	.heading::after {
		content: '';
		flex: 1 1 24px;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--gold));
	}

	.heading::after {
		background: linear-gradient(90deg, var(--gold), transparent);
	}

	.text {
		margin: 0 0 10px;
	}

	.note {
		margin: 0 0 12px;
		text-align: center;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--gold-light);
	}

	.disclaimer {
		font-size: 0.88em;
		color: rgba(245, 236, 217, 0.82);
	}

	/* diamond-bulleted list */
	.list {
		list-style: none;
		margin: 0 0 10px;
		padding: 0;
	}

	.list li {
		position: relative;
		padding-left: 20px;
		margin-bottom: 6px;
	}

	.list li::before {
		content: '';
		position: absolute;
		left: 3px;
		top: 0.55em;
		width: 6px;
		height: 6px;
		background: var(--gold);
		transform: rotate(45deg);
	}

	/* small data table (free-spin awards) */
	.table {
		width: min(100%, 340px);
		margin: 0 auto 12px;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.table th {
		padding: 6px 10px;
		font-size: 0.8em;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--gold);
		border-bottom: 1px solid var(--gold);
	}

	.table td {
		padding: 6px 10px;
		font-weight: 600;
		border-bottom: 1px solid var(--hairline);
	}

	/* controls guide */
	.controls {
		display: grid;
		grid-template-columns: minmax(8em, max-content) minmax(0, 1fr);
		gap: 10px 18px;
		margin: 0;
	}

	.controls dt {
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--gold-light);
	}

	.controls dd {
		margin: 0;
	}

	/* ---------- symbols ---------- */

	.symbols {
		list-style: none;
		margin: 0 0 12px;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 270px), 1fr));
		gap: 10px;
	}

	.symbol {
		min-width: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: linear-gradient(180deg, rgba(26, 28, 33, 0.9), rgba(11, 12, 14, 0.9));
		border: 1px solid var(--hairline);
	}

	.symbol.special {
		grid-column: 1 / -1;
		border-color: var(--gold);
	}

	.symbol.scatter {
		border-color: var(--rouge);
		box-shadow: inset 0 0 0 1px rgba(179, 18, 46, 0.35);
	}

	.art {
		width: clamp(56px, 4vw + 40px, 88px);
		aspect-ratio: 1;
		object-fit: contain;
		user-select: none;
		-webkit-user-drag: none;
	}

	.symbol-body {
		min-width: 0;
	}

	.symbol-name {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		margin-bottom: 4px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--gold-light);
	}

	.role {
		padding: 1px 8px 0;
		font-size: 0.72em;
		letter-spacing: 0.18em;
		color: var(--lacquer);
		background: var(--gold);
	}

	.scatter .role {
		color: var(--ivory);
		background: var(--rouge);
	}

	.pays {
		width: 100%;
		max-width: 400px;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	.pays th,
	.pays td {
		padding: 2px 0;
		border-bottom: 1px solid rgba(212, 175, 98, 0.16);
	}

	.pays tr:last-child th,
	.pays tr:last-child td {
		border-bottom: 0;
	}

	.pays th {
		width: 2em;
		text-align: left;
		font-weight: 700;
		color: var(--gold);
	}

	.pays .mult {
		font-weight: 600;
		white-space: nowrap;
	}

	/* Josefin's multiplication sign is tiny; use a sturdier fallback glyph */
	.times {
		margin-left: 1px;
		font-family: 'Helvetica Neue', Arial, sans-serif;
		font-size: 0.9em;
		color: var(--gold);
	}

	.pays .amount {
		text-align: right;
		color: var(--gold-light);
		overflow-wrap: anywhere;
	}

	.desc {
		margin: 6px 0 0;
		font-size: 0.94em;
	}

	/* ---------- paylines ---------- */

	.paylines {
		list-style: none;
		margin: 0 0 12px;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
		gap: 8px;
	}

	.payline {
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px 6px 8px;
		border: 1px solid var(--hairline);
		background: rgba(26, 28, 33, 0.7);
	}

	.line-number {
		font-family: var(--display);
		font-size: 14px;
		line-height: 1;
		color: var(--gold);
	}

	.payline svg {
		display: block;
		width: 100%;
		max-width: 110px;
		height: auto;
	}

	.cell {
		fill: var(--lacquer-3);
		stroke: var(--gold-deep);
		stroke-width: 0.5;
	}

	.cell.on {
		fill: var(--gold);
		stroke: var(--gold-light);
	}

	.trace {
		fill: none;
		stroke: var(--rouge);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.version {
		margin-top: 18px;
		padding-top: 10px;
		border-top: 1px solid var(--hairline);
		text-align: center;
		font-size: 11px;
		letter-spacing: 0.12em;
		color: rgba(245, 236, 217, 0.6);
	}

	/* ---------- screen sizes ---------- */

	@media (min-height: 700px) and (min-width: 700px) {
		.salon-modal {
			padding: 24px;
		}
	}

	@media (max-width: 560px) {
		.controls {
			grid-template-columns: minmax(0, 1fr);
			gap: 2px;
		}

		.controls dd {
			margin-bottom: 10px;
		}

		.titles {
			padding-left: 0;
			align-items: flex-start;
		}

		.title {
			text-align: left;
		}
	}

	/* popout S (400x225) and landscape phones: keep the header short */
	@media (max-height: 420px) {
		.salon-modal {
			padding: 4px;
		}

		.head {
			padding-top: 4px;
			padding-bottom: 4px;
		}

		.eyebrow {
			display: none;
		}

		.title {
			font-size: 18px;
		}

		.close {
			width: 44px;
			height: 44px;
		}

		.panel::before,
		.panel::after {
			display: none;
		}

		.section {
			margin-top: 12px;
		}

		.art {
			width: 52px;
		}

		.paylines {
			grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
		}
	}
</style>
