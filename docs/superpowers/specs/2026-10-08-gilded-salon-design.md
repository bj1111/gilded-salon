# Gilded Salon — Presentation Redesign (Design Spec)

Date: 2026-10-08 · Status: approved direction (visual identity + mobile layout approved by owner; remaining sections use the defaults below, owner asked to proceed with the build)

## 1. Goal

Turn the working "Sticky Fruits" prototype into **Gilded Salon**, a polished, commercially credible Stake Engine slot, without touching the game mathematics. Deliverable: a rebuilt `upload/frontend/` ready for Stake Engine review, with `upload/math/` unchanged.

## 2. Hard constraints

- **Math is the source of truth and is not modified.** `math-sdk/games/sticky_fruits/**`, `upload/math/**` and the generated `apps/sticky_fruits/src/game/config.ts` stay byte-identical (hashes recorded before work starts and re-checked at the end).
- The presentation only renders what the book says: final boards come from `reveal.board`, passing symbols come from the math reel strips (`config.paddingReels`), anticipation only where `reveal.anticipation` flags it, amounts only from book events. No fake outcomes or staged near-misses.
- SDK plumbing (xstate machines, RGS requests, authenticate/replay, book playback, bet/balance state) is reused unchanged. The uncommitted edits to `packages/components-ui-pixi` are reverted (SDK back to stock); the game owns its presentation inside `apps/sticky_fruits`.
- Internal folder/package names stay `sticky_fruits` (math export script writes there). Everything player-facing says **Gilded Salon**.
- Build must load nothing from external hosts (fonts bundled, no Typekit).

## 3. Math facts the design relies on (from audit)

5×3, 20 fixed lines (left→right, 3+ of a kind), one mode `base` (cost 1×), RTP 96.50 %, max win 10,000×, hit rate 1 in 3.67. Symbols: W (wild, also pays 5/20/100), H1 5/20/100, H2 3/10/40, H3 2/8/30, H4 1.5/5/20, L1 1.2/3/10, L2 0.8/2/8, L3 0.6/1.5/6, L4 0.5/1.2/5, L5 0.4/1/4, S (scatter, no pay). 3/4/5 S → 8/10/12 free spins; 3+ S in free spins → +5. Every W landing in free spins becomes sticky for the rest of the bonus. Book amounts are bet multiple ×100. Events: reveal, winInfo, setWin, setTotalWin, freeSpinTrigger, updateFreeSpin (0-based), newStickyWilds, freeSpinRetrigger, freeSpinEnd, wincap, finalWin.

## 4. Visual identity

Monte Carlo, 1928 — the private high-limit salon after midnight, strict art deco. Approved concept mockups: `design/gilded-salon-mockups/`.

- **Palette:** lacquer `#0B0C0E`–`#1A1C21`; felt emerald `#145142`–`#061C15`; gold `#FFF4CF/#F0D592/#C99A45/#8C6A2E`; ivory `#F5ECD9` (all text); rouge `#B3122E` (accent only: scatter, anticipation, max win, free-spin curtains).
- **Type:** Limelight (logo, tier banners, letters), Josefin Sans 600/700 (UI, numbers). OFL, self-hosted. Counters use fixed-width digit cells.
- **Symbols:** W Golden Chip · H1 Roulette Wheel · H2 Brilliant Diamond · H3 Dice (ivory, rouge pips) · H4 Fan of Aces · L1–L5 A K Q J 10 in Limelight with enamel (emerald, rouge, sapphire, amethyst, amber) + gold suit · S Golden Key on lacquer medallion with "BONUS" plate. Letters heavier/larger than the mock for phone legibility.
- **Scene:** fluted brass frame with stepped corners and sunburst-fan crest holding the logo plaque; emerald baize reel bed with brass dividers and inner vignette; lacquer table rail carrying the HUD. Background: deco salon wall (panelling, pilasters, chandelier glow) with arched windows onto Monaco harbour at night. Free spins "The Private Room": rouge velvet curtains, darker room, spotlight cone.
- **Effects language:** gold light, four-point glints, chips. No rainbow confetti, no constant motion.

## 5. Layouts

Pixi HUD owned by the app, chosen from `stateLayoutDerived.layoutType()`:
- **Desktop / tablet-landscape:** board centred, crest above; WIN under the board; rail across the bottom with menu + sound (left), balance, autoplay · SPIN · turbo (centre), bet −/value/+ (right).
- **Portrait (approved):** full-width reels with crest above, WIN plaque hanging under the reels, compact rail = bottom ≈23 %: row 1 autoplay · SPIN · turbo; row 2 menu · balance · − bet +.
- **Landscape phone / popout S (400×225) / popout L (800×450):** board left-centre, vertical control column on the right (spin largest), balance/bet/win stacked compactly.
- Required working sizes: 1024×576, 400×225, 800×450, 425×812, plus 1920×1080, 1366×768, 390×844, 768×1024. Touch targets ≥ 44 px on phones.

## 6. Spin lifecycle & motion

Loading → HTML loader (instant, no GIFs): lacquer screen, crest drawing in gold, wordmark, gold progress line driven by real asset progress → "TAP TO ENTER" (audio unlock) → lacquer doors part → reels drop in staggered.
Idle: window lights twinkle, chandelier glint, logo light sweep every ~20 s, slow spin-button breathe. Reels static.
Spin: button press-down 80 ms, glyph rotates while spinning, STOP state when slam-stop allowed. Balance ticks down (SDK debit), WIN fades to 0. Reels wind up (≈10 px lift) then drop in, 70 ms stagger; blurred symbol variants at speed.
Stops: left→right ≈180 ms apart, ease-in + ≈12 px overshoot + settle, thunk + brass divider flash. Press→last stop ≈1.6–1.9 s normal; turbo ≈ simultaneous, small bounce. Wild chip landing: clack + gold ring. Key landing: rouge glint + chime rising with key count. Anticipation only on math-flagged reels: longer spin, rouge reel outline, background dims, tension sound. Slam stop via button/Space (non-anticipating reels).

## 7. Win presentation

Presentation tier from the **win multiple** (amount/100), thresholds aligned with the math's `standard` win-level bands (fixes the current bug where setWin and freeSpinEnd level numbers were mapped to the same names):

| Tier | Multiple | Treatment | Count-up |
|---|---|---|---|
| none | 0 | nothing; quick return to idle | – |
| small | < 1× | line trace, winners pulse, others dim, plaque | 0.5 s |
| nice | 1–5× | + glints on winners, gold plaque | 0.9–1.3 s |
| great | 5–15× | + chip burst from winners, frame light sweep | 1.8 s |
| BIG WIN | 15–30× | full takeover: dim, deco rays, banner, chip shower | ≈4 s |
| GRAND WIN | 30–50× | takeover escalates banner during count | ≈6 s |
| MEGA WIN | 50–100× | stronger shower, gold flash | ≈8 s |
| LEGENDARY | 100×+ | strongest shower, light screen shake (once) | ≈10 s |
| MAX WIN | 10,000× | unique "MAX WIN" treatment | ≈12 s |

Takeover banners escalate as the counter passes each threshold. Every count-up is skippable (tap/Space → final value, hold 0.8 s). Paylines: each winning line drawn as a gold glow trace through its winning cells (from `meta.lineIndex` + `config.paylines`). WIN field mirrors `setTotalWin`. Balance credit animates when the SDK applies it after presentation. Durations shortened in turbo/autoplay.

## 8. Free spins — "The Private Room"

Trigger: keys pulse with rouge glow + chime cascade → intro panel ("THE PRIVATE ROOM · N FREE SPINS · Wild chips stay on the felt", tap to start) → curtains draw in, room darkens, music changes. Crest plaque shows "FREE SPINS n OF N" (updateFreeSpin amount+1). Sticky wilds: chip drops onto the cell, spins on its edge, lands with clack + ring and stays; "CHIPS ON THE FELT n" counter from `totalStickyWilds`. Retrigger (new handler for `freeSpinRetrigger`): keys glow, "+5 FREE SPINS" banner, counter total rolls up. End: "BONUS COMPLETE" panel with tiered count-up (takeover if ≥15×), croupier-rake sweep clears the chips, curtains open. Max win (`wincap`): MAX WIN treatment, bonus ends.

## 9. Audio — synthesized, original

App module `src/audio/`: WebAudio engine (master → music bus + sfx bus), synth "voices" for every sound, semantic API (`play('reelStop', { reel })`), override loader (a licensed file at `static/assets/audio-override/<key>.mp3` replaces the synth voice). Master mute/volume follows the SDK sound settings (sound-off mutes everything). Suspends when the tab is hidden; unlocked by the loader's tap. The 17 MB SDK sample audio is removed. Sounds: ui click, spin press, reel start whoosh, reel stop ×5, wild land, key land ×1–5 (rising), anticipation, win small/nice/great, count tick, tier stingers (big/grand/mega/legendary/max), chip shower, free-spins intro, chip lock, retrigger, bonus end, lounge music loop (base) and private-room loop (free spins).

## 10. Architecture (app-owned presentation)

`apps/sticky_fruits/`:
- `art/` — modular SVG→PNG generator (Chrome via playwright-core): symbols (+ motion-blur variants), scene, UI, fx textures; writes `static/assets/sprites/gs/*.png` + `src/game/artAssets.ts`. Bundled fonts in `static/assets/fonts/`.
- `src/presentation/` — pure logic: `winTiers.ts` (tier from multiple, durations, escalation steps), `paylines.ts` (cells for a win), unit-tested.
- `src/motion/` — promise-based tween/timeline helpers on the Pixi ticker (`tween`, `sequence`, `stagger`, easings), cancellable.
- `src/fx/` — pooled particle system (chips, glints), line trace, light sweep, glow.
- `src/audio/` — engine, voices, sound map, overrides.
- `src/ui/` — HUD (`Hud.svelte` + per-layout components: SpinButton, RoundButton, ValueLabel, BetControl, WinPlaque) using SDK state/providers; `GameModals.svelte` composing the SDK modals with app-owned PayTable and Rules modals.
- `src/components/` — scene components (Background, BoardFrame, Board, symbols, Win takeover, FreeSpin intro/outro/counter, curtains, loader).
- `vite.config.js` alias `webfontloader` → local shim so the SDK's Typekit preload never runs; fonts loaded locally.

## 11. Stake Engine compliance (part of "ready to upload")

Remove Stake Engine loader and SDK sample loader/audio/art; no external hosts; real paytable (all symbol pays, 20 line diagrams, RTP 96.50 %, max win 10,000×, how wins form, free spins + retrigger + sticky wilds, every UI button explained, general disclaimer) and game rules; spacebar spins; autoplay confirmation kept; sound-off mutes all; viewport disables double-tap zoom, no scrolling; social mode (`social=true`) wording swaps restricted words (bet, buy, pay, win-money terms, "paytable"); currencies USD/EUR/CAD/MXN/JPY + XSC/XGC formatting via SDK; replay mode works (Play / Play Again, no betting UI); sub-cent display.

## 12. Testing

- Unit (vitest): win tiers, payline cells, count-up timing, sound-map coverage, "every book event type has a handler".
- Book integrity: Storybook harness plays sampled real books (base, bonus, retrigger, max win) and asserts displayed final board == last reveal board, WIN == finalWin, presentation returns to idle.
- End-to-end on the production build against a local mock RGS (authenticate/play/end-round/event/replay using library books): spins, balance, bet changes, rapid clicking, reload/resume, replay.
- Responsive screenshots at the §5 sizes; performance check (FPS during big win, no leaked tickers/listeners after many spins); bundle/asset size report; grep for external URLs.

## 13. Risks

Math-adjacent touch points (board placement, padding rows, anticipation flags, win positions with padding offset, sticky positions, amounts, bet type/end-round timing) stay in SDK code paths; presentation only reads them. Highest-risk edits: reel timing constants (must not change which symbols land — only speed/easing), `bookEventHandlerMap.ts` (added handlers must await correctly so the state machine isn't released early), HUD replacement (must keep Space/autoplay/turbo/bet-level behaviour and jurisdiction flags).
