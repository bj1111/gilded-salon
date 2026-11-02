# Gilded Salon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Sticky Fruits frontend as Gilded Salon (art, HUD, motion, wins, free spins, loader, audio, compliance) on top of the untouched math, and package `upload/frontend`.

**Architecture:** SDK plumbing (xstate, RGS, book playback, bet/balance state, HTML modals) stays as is; the app owns all presentation in `apps/sticky_fruits/src/{ui,presentation,motion,fx,audio,components}` plus a modular SVG→PNG art generator. Shared-package edits are reverted.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, PixiJS 8 via pixi-svelte, xstate 5 (SDK), WebAudio, playwright-core + Chrome (art + tests), vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-gilded-salon-design.md`

Paths below are relative to `web-sdk/apps/sticky_fruits/` unless they start with `web-sdk/`, `math-sdk/` or `upload/`.

## Global Constraints

- Never modify `math-sdk/games/sticky_fruits/**`, `upload/math/**`, `src/game/config.ts`. Hashes checked at start and end.
- Board shown = `reveal.board`; spin filler = `config.paddingReels`; anticipation only from `reveal.anticipation`; amounts only from book events.
- Player-facing name "Gilded Salon"; internal names stay `sticky_fruits`.
- No external network requests from the built game (no Typekit, no CDN).
- Palette: lacquer `0x0B0C0E/0x1A1C21`, felt `0x145142/0x061C15`, gold `0xFFF4CF/0xF0D592/0xC99A45/0x8C6A2E`, ivory `0xF5ECD9`, rouge `0xB3122E`. Fonts: Limelight, Josefin Sans 600/700.
- Win tiers by multiple m = amount/100: small <1, nice 1–5, great 5–15, big 15–30, grand 30–50, mega 50–100, legendary ≥100, max ≥10000.
- No git commits unless the owner asks (owner instruction); keep a backup of the original app before edits.

## Review Focus

- Rapid spin/space presses during presentation or transitions → state machine never double-fires a bet; HUD stays consistent.
- Resume of an interrupted bonus (`createBonusSnapshot`) → sticky chips, counter and crest restored without animations.
- Replay mode (`replay=true`) → no bet controls, Play/Play Again only, no wallet calls.
- Tiny screens (popout 400×225) and tall phones (390×844) → nothing overlaps or is cut off; touch targets ≥44 px.
- Social mode (`social=true`) → no restricted words in any HUD/modal text; currency without `$` for XSC/XGC.

---

### Task 0: Baseline, safety net, test runner

**Files:** Create `vitest.config.ts`, `src/presentation/sanity.test.ts`; Modify `package.json` (script `test`); Revert `web-sdk/packages/components-ui-pixi/src/**` to HEAD (save patch to `stake /backups/components-ui-pixi.patch`).

- [ ] Record SHA-256 of `upload/math/*`, `src/game/config.ts`, `math-sdk/games/sticky_fruits/*.py` to `stake /backups/math-hashes.txt`.
- [ ] Tar the current app to `stake /backups/sticky_fruits-original.tgz` (exclude node_modules/build).
- [ ] Save the shared-package diff as a patch, then `git checkout -- packages/components-ui-pixi`.
- [ ] `pnpm add -D vitest@3.2.4 --filter sticky_fruits`; add `"test": "vitest run"`; run sanity test → PASS.

### Task 1: Presentation logic (pure, tested)

**Files:** Create `src/presentation/winTiers.ts`, `src/presentation/paylines.ts`, tests beside them, `src/presentation/bookCoverage.test.ts`.

**Interfaces (Produces):**
- `type WinTier = 'none'|'small'|'nice'|'great'|'big'|'grand'|'mega'|'legendary'|'max'`
- `tierForMultiple(m: number): WinTier`
- `isTakeover(t: WinTier): boolean` (big and above)
- `countUpMs(t: WinTier, { fast }: { fast: boolean }): number` — none 0, small 500, nice 1100, great 1800, big 4000, grand 6000, mega 8000, legendary 10000, max 12000; fast = ×0.5 (min 300 for non-none).
- `takeoverSteps(amount: number): { tier: WinTier; at: number }[]` — banner upgrade points (amount units ×100) for each takeover threshold ≤ amount.
- `TIER_LABEL: Record<WinTier, string>` — big 'BIG WIN', grand 'GRAND WIN', mega 'MEGA WIN', legendary 'LEGENDARY', max 'MAX WIN'.
- `winCells(win: { positions: Position[] }): Position[]` (visible rows = row-1), `lineCells(lineIndex: number, paylines): Position[]` (5 cells of that line, visible rows).

- [ ] Tests: `tierForMultiple(0)='none'`, `(0.4)='small'`, `(1)='nice'`, `(4.99)='nice'`, `(5)='great'`, `(15)='big'`, `(30)='grand'`, `(50)='mega'`, `(100)='legendary'`, `(10000)='max'`; `takeoverSteps(4500)` → big@1500, grand@3000; `lineCells(4, config.paylines)` → rows [0,1,2,1,0]; bookCoverage: every `type` in `src/stories/data/*_books.ts` has a key in `bookEventHandlerMap` (expected to FAIL until Task 8 adds `freeSpinRetrigger`).
- [ ] Implement; run `pnpm test` → all pass except coverage (tracked).

### Task 2: Art generator v2

**Files:** Create `art/lib/{svg.mjs,palette.mjs,symbols.mjs,scene.mjs,ui.mjs,fx.mjs}`, `art/generate.mjs` (rewrite), `art/fonts/*.woff2`; Output `static/assets/sprites/gs/*.png`, `src/game/artAssets.ts`. Delete `static/assets/sprites/premium/`.

**Produces (texture keys):** `sym_{W,H1..H4,L1..L5,S}`, `sym_{…}_blur`; `bg_wall`, `bg_window_l`, `bg_window_r`, `bg_private`, `curtain_l`, `curtain_r`, `chandelier`; `frame`, `crest_fan`, `logo_plaque`, `felt`, `reel_divider`; `rail`, `btn_round`, `btn_spin_ring`, `btn_spin_core`, `icon_{spin,stop,auto,turbo,menu,sound,soundOff,plus,minus,info,rules,settings,close}`, `plaque`, `panel`; `fx_glow`, `fx_glint`, `fx_ring`, `fx_ray`, `fx_dot`, `fx_chip`, `fx_spot`. `ART_GEOMETRY` exports frame padding and crest size in game units.

- [ ] Port the approved mock (`design/gilded-salon-mockups`, scratch `mock/art.js`) into modules; letters heavier/larger; deco wall panelling + chandelier.
- [ ] Blur variants: same SVG with vertical feGaussianBlur (stdDeviation 0 9) stretched 1.25×.
- [ ] Render with fonts embedded via `@font-face` data URLs; verify with a contact-sheet screenshot.

### Task 3: Theme, fonts, external-request removal

**Files:** Modify `src/game/theme.ts`, `src/app.html`, `vite.config.js`; Create `src/shims/webfontloader.ts`, `static/assets/fonts/{Limelight-Regular,JosefinSans-SemiBold,JosefinSans-Bold}.woff2`, `src/game/fonts.ts`.

**Produces:** `THEME` (palette above, `display: 'Limelight'`, `font: 'Josefin Sans'`), `textStyle.{display,value,caption,label}(size, overrides)`; `loadFonts(): Promise<void>` (FontFace from bundled files).

- [ ] Alias `webfontloader` → shim whose `load(cfg)` calls `cfg.active()` (SDK Typekit preload becomes a no-op).
- [ ] Viewport `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`; body `touch-action: manipulation`; remove Typekit link.
- [ ] Verify: built `index.html` + bundle contain no `typekit`/`googleapis`.

### Task 4: Scene (background, frame, board, layout)

**Files:** Modify `src/components/{Background,BoardFrame,Board,SymbolArt,ReelSymbol}.svelte`, `src/game/{stateGame.svelte.ts,stateLayout.ts,constants.ts}`; Create `src/components/{SalonWindows,Chandelier,LightSweep}.svelte`.

**Produces:** `stateGameDerived.boardLayout()` now orientation-aware: `{ x, y, scale }` per layout (desktop: centre x, y = 0.43 H, scale 1.0; portrait: full-width, y = 0.40 H; landscape/popout: x = 0.42 W).

- [ ] Background: wall + windows (twinkle via alpha tweens, ≤ 8 lights), chandelier glint, sweep every 20 s; free-spin fade to `bg_private`.
- [ ] Frame: frame + crest + logo; free-spin crest shows counter (Task 9 hook `crestMode`).
- [ ] Symbols use `sym_*` / `sym_*_blur`; win glow uses `fx_glow`.
- [ ] Screenshot desktop 1600×900 and portrait 390×844 via storybook `components-game--pre-spin`.

### Task 5: HUD

**Files:** Create `src/ui/{Hud,HudDesktop,HudPortrait,HudLandscape,HudReplay,SpinButton,RoundButton,ValueLabel,BetControl,WinField,MenuOverlay}.svelte`, `src/ui/hudLayout.ts`; Modify `src/components/Game.svelte` (replace `<UI>`).

**Consumes:** SDK `stateBet`, `stateBetDerived`, `stateConfig`, `stateUi`, `stateModal`, `stateSound`, `EnableSpaceHold`, `OnHotkey`, `Button` (components-pixi), event names `bet`, `stopButtonClick`, `stopButtonEnable`, `soundPressBet`, `soundPressGeneral`, `uiShow`, `uiHide`.
**Produces:** `hudLayout(layoutType, canvas): HudSlots` (pure; positions for spin, auto, turbo, menu, balance, bet, win) — unit tested for no overlaps at 400×225, 425×812, 1024×576, 1920×1080.

- [ ] SpinButton mirrors `ButtonBetProvider` keys (spin_default/spin_disabled/stop_default/stop_disabled) and Space hotkey; states idle/hover/press/spinning/stop/disabled/win-pulse.
- [ ] BetControl mirrors SDK `ButtonIncrease/ButtonDecrease` stepping over `stateConfig.betAmountOptions`; tap on value opens `betAmountMenu`.
- [ ] Menu overlay: paytable, rules, settings, sound toggle, close. Replay mode → HudReplay (no bet controls).
- [ ] Screenshots at the 8 sizes in spec §5.

### Task 6: Motion & FX utilities

**Files:** Create `src/motion/{easing.ts,tween.ts}`, tests; `src/fx/{Particles.svelte,particlePool.ts,LineTrace.svelte,Glint.svelte}`.

**Produces:** `tween(target, to: Record<string,number>, { ms, ease, delay }): Promise<void>` + `cancel`; `easing.{outCubic,inOutCubic,outBack(1.6),inBack}`; `createParticlePool(max)` with `emit({x,y,count,kind:'chip'|'glint',spread,speed,gravity})`, auto-cleanup on ticker; `LineTrace` draws cells → glowing polyline with nodes, animated stroke progress.

- [ ] Tests: easing endpoints 0→0, 1→1; outBack overshoots >1; pool never exceeds `max` and frees on completion.

### Task 7: Spin feel

**Files:** Modify `src/game/constants.ts` (spin options), `src/game/stateGame.svelte.ts` (landing hooks), `src/components/{Anticipation,Anticipations,BoardFrame}.svelte`; Create `src/components/LandingFx.svelte`.

- [ ] Timing: stagger 70 ms, stop gap ≈180 ms (padding multiplier tuned), bounce ≈12 px, turbo minimal; wind-up lift via pre-spin `backIn`.
- [ ] Landing: only visible rows (1–3) trigger wild/scatter landing fx + sounds (fixes padding-row inflation); key chime index from visible keys.
- [ ] Anticipation: rouge outline + background dim on math-flagged reels only.
- [ ] Verify: storybook spin capture — final board equals book reveal (visible rows), stops staggered.

### Task 8: Win presentation

**Files:** Modify `src/game/bookEventHandlerMap.ts`, `src/components/{Win,Board}.svelte`; Create `src/components/{WinPlaque,WinTakeover,WinLines}.svelte`; Delete `src/game/winLevelMap.ts` usages.

- [ ] `winInfo`: dim non-winners, LineTrace each win (from `meta.lineIndex`), pulse winners; awaits ≤ 900 ms (fast: 400).
- [ ] `setWin`: tier by multiple → plaque (small/nice/great, chip burst for great) or takeover with escalation (`takeoverSteps`), skippable.
- [ ] `freeSpinRetrigger` handler (+5 banner, counter roll) → bookCoverage test passes.
- [ ] Verify storybook `winInfo`, `setWin`, base random, bonus maxWin captures.

### Task 9: Free spins — The Private Room

**Files:** Modify `src/components/{FreeSpinIntro,FreeSpinOutro,FreeSpinCounter,StickyWilds,Background,BoardFrame}.svelte`, `src/game/bookEventHandlerMap.ts`; Create `src/components/{Curtains,ChipCounter,RakeSweep}.svelte`.

- [ ] Intro panel, curtains close in, crest counter "FREE SPINS n OF N", chip drop + edge spin + ring on `newStickyWilds`, chip counter from `totalStickyWilds`, outro with tiered count, rake sweep clears chips, curtains open; wincap → MAX WIN.
- [ ] Resume snapshot path restores chips/counter/curtains without animation.

### Task 10: Loader & transitions

**Files:** Modify `src/routes/+layout.svelte`, `src/components/{Game,LoadingScreen}.svelte`, `src/game/assets.ts` (only core art preload); Create `src/components/HtmlLoader.svelte`, `src/components/Doors.svelte`.

- [ ] Remove `LoaderStakeEngine`/`LoaderExample` and the two GIFs; HTML loader (CSS crest draw, wordmark, progress from `stateApp.loadingProgress` / asset count), fades when Pixi ready; TAP TO ENTER; doors part; reels drop in.

### Task 11: Audio engine (parallel-safe)

**Files:** Create `src/audio/{engine.ts,voices.ts,music.ts,soundMap.ts,overrides.ts}`, `src/audio/soundMap.test.ts`; Modify `src/components/{Sound,EnableSound}.svelte`, `src/game/{sound.ts,assets.ts}`; Delete `static/assets/audio/*`.

**Produces:** `audio.unlock()`, `audio.play(name: SfxName, opts?)`, `audio.loop(name)`, `audio.stop(name)`, `audio.music(track: 'base'|'private'|null)`, `audio.setVolume(0..1)`; `SfxName` union per spec §9.
- [ ] Test: every name used by `Sound.svelte` emitter mapping resolves to a voice; volume 0 → master gain 0.

### Task 12: Compliance content

**Files:** Create `src/ui/modals/{GameModals,ModalPayTable,ModalRules}.svelte`, `src/i18n/copy.ts` (normal + social variants); Modify `src/components/Game.svelte`, `vite.config.js` (strip SDK sample URL literals).

- [ ] Paytable: every symbol (art + 3/4/5 pays as multiples × current bet), 20 line diagrams, RTP 96.50 %, max win 10,000×, free spins/retrigger/sticky rules, button guide, general disclaimer text (from Stake docs template).
- [ ] Social copy swaps restricted words; currency formatting via SDK.

### Task 13: Verification

**Files:** Create `src/stories/Integrity.stories.svelte`, `tools/integrity.mjs`, `tools/mock-rgs.mjs`, `tools/e2e.mjs`, `tools/shots.mjs`.

- [ ] Integrity: ≥200 weighted books (incl. retrigger, max win) played in turbo; assert board == last reveal, WIN == finalWin, idle reached, no console errors.
- [ ] Mock RGS + production build: authenticate, 50 spins, bet change, rapid clicks, reload mid-bonus resume, replay URL.
- [ ] Screenshots at the 8 sizes; FPS ≥ 55 during big win on desktop Chrome; no ticker/listener growth after 100 spins.
- [ ] Math hashes unchanged; grep build for `http` → only `new URL(` relative uses.

### Task 14: Package & report

- [ ] `pnpm --filter sticky_fruits build` → replace `upload/frontend` (keep `upload/math`); size report.
- [ ] Write `design/ART_BRIEF.md` (asset list, sizes, override procedure) and final report per owner brief §27.
