<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'TEST/integrity',
	});
</script>

<script lang="ts">
	import { StoryGameTemplate, StoryLocale, type TemplateArgs, templateArgs } from 'components-storybook';
	import { stateBet } from 'state-shared';

	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { playBet } from '../game/utils';
	import { stateGame } from '../game/stateGame.svelte';
	import baseBooks from './data/base_books';
	import bonusBooks from './data/bonus_books';
	import maxWinBooks from './data/maxwin_books';
	import bonusModeBooks from './data/bonus_mode_books';
	import superModeBooks from './data/super_mode_books';
	import huntModeBooks from './data/hunt_mode_books';

	// Test harness (Storybook only, never in the game build): plays real books from the math through
	// the real presentation and checks, after every round, that the reels show exactly the final
	// reveal board and that the WIN field equals the book's final win. Results are written to
	// #integrity for tools/integrity.mjs to read.
	setContext();

	type Result = { id: number; ok: boolean; problems: string[] };
	let results = $state<Result[]>([]);
	let done = $state(false);

	const hasRetrigger = (book: any) => book.events.some((e: any) => e.type === 'freeSpinRetrigger');
	// ?from=N skips the first N books, so an interrupted run can continue (tools/integrity.mjs --from N)
	const FROM = Number(new URLSearchParams(location.search).get('from') ?? 0) || 0;
	const BOOKS = [
		...baseBooks.slice(0, 120),
		...bonusBooks.filter(hasRetrigger).slice(0, 4),
		...bonusBooks.filter((b: any) => !hasRetrigger(b)).slice(0, 6),
		...maxWinBooks.slice(0, 1),
		// bought rounds and Bonus Hunt, sampled at their published odds (export_frontend.py)
		...bonusModeBooks,
		...superModeBooks,
		...huntModeBooks,
	].slice(FROM);

	const check = (book: any): Result => {
		const problems: string[] = [];
		const reveals = book.events.filter((e: any) => e.type === 'reveal');
		const last = reveals[reveals.length - 1];
		for (let reel = 0; reel < 5; reel++) {
			for (let row = 1; row <= 3; row++) {
				const shown = stateGame.board[reel].reelState.symbols[row]?.rawSymbol.name;
				const expected = last.board[reel][row].name;
				if (shown !== expected) problems.push(`reel ${reel} row ${row}: shown ${shown}, book ${expected}`);
			}
		}
		const final = book.events.find((e: any) => e.type === 'finalWin')?.amount ?? 0;
		if (stateBet.winBookEventAmount !== final) problems.push(`WIN ${stateBet.winBookEventAmount} != finalWin ${final}`);
		if (stateGame.stickyWilds.length !== 0) problems.push(`sticky wilds left on the felt: ${stateGame.stickyWilds.length}`);
		if (stateGame.gameType !== 'basegame') problems.push(`gameType ${stateGame.gameType} after the round`);
		return { id: book.id, ok: problems.length === 0, problems };
	};

	const runAll = async () => {
		stateBet.isTurbo = true;
		stateBet.wageredBetAmount = 1;
		stateBet.betAmount = 1;
		for (const book of BOOKS) {
			await playBet({ ...book, state: book.events } as any);
			results = [...results, check(book)];
		}
		done = true;
	};
</script>

{#snippet template(args: TemplateArgs<any>)}
	<StoryGameTemplate skipLoadingScreen={args.skipLoadingScreen} action={async () => await runAll()}>
		<StoryLocale lang="en">
			<Game />
		</StoryLocale>
	</StoryGameTemplate>
	<pre
		id="integrity"
		style="position:fixed;right:0;top:0;max-width:40vw;max-height:30vh;overflow:auto;margin:0;font:10px monospace;color:#fff;background:#000a;z-index:9999">{JSON.stringify({
			done,
			total: BOOKS.length,
			played: results.length,
			failed: results.filter((r) => !r.ok),
		})}</pre>
{/snippet}

<Story name="books" args={templateArgs({ skipLoadingScreen: true, data: {}, action: async () => {} })} {template} />
