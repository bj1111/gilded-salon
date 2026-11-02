# Gilded Salon — Art Brief

Every image in the game is a code-drawn original produced by `art/generate.mjs` (SVG rendered in Chrome). Any of them can be replaced by commissioned or licensed art **without code changes**:

1. Produce the image at the **pixel size** listed (or larger, same aspect ratio).
2. Save it with the **exact file name and format** below into `web-sdk/apps/sticky_fruits/static/assets/sprites/gs/`.
3. Rebuild (`pnpm --filter sticky_fruits build`) and copy `build/` to `upload/frontend/`.

Do **not** re-run `art/generate.mjs` afterwards — it would overwrite your files (or run it with only the keys you still want generated, e.g. `node art/generate.mjs fx_glow fx_ring`).

## Style rules

- Monte Carlo, 1928: the private high-limit salon after midnight, strict art deco (sunburst fans, stepped corners, fluted brass).
- Palette: lacquer black `#0B0C0E`–`#1A1C21`, emerald felt `#145142`–`#061C15`, champagne gold `#FFF4CF / #F0D592 / #C99A45 / #8C6A2E`, ivory `#F5ECD9`, rouge `#B3122E` (accent only).
- One key light from the top-left on every symbol; shared gold-rim language.
- Symbols: transparent PNG, subject centred, ~6 % margin, drawn for a 256 × 256 box (shipped at 410 px).
- Each symbol has a `_blur` twin (vertical motion blur, same framing) used while reels spin; replace both.
- Fonts: Limelight (display) and Josefin Sans (UI), SIL OFL, bundled in `static/assets/fonts/`.

## Asset list

### Symbols (reels)

| File | Drawn at (units) | Shipped pixels |
|---|---|---|
| `sym_W.png` | 256 × 256 | 410 × 410 |
| `sym_W_blur.png` | 256 × 256 | 256 × 256 |
| `sym_H1.png` | 256 × 256 | 410 × 410 |
| `sym_H1_blur.png` | 256 × 256 | 256 × 256 |
| `sym_H2.png` | 256 × 256 | 410 × 410 |
| `sym_H2_blur.png` | 256 × 256 | 256 × 256 |
| `sym_H3.png` | 256 × 256 | 410 × 410 |
| `sym_H3_blur.png` | 256 × 256 | 256 × 256 |
| `sym_H4.png` | 256 × 256 | 410 × 410 |
| `sym_H4_blur.png` | 256 × 256 | 256 × 256 |
| `sym_L1.png` | 256 × 256 | 410 × 410 |
| `sym_L1_blur.png` | 256 × 256 | 256 × 256 |
| `sym_L2.png` | 256 × 256 | 410 × 410 |
| `sym_L2_blur.png` | 256 × 256 | 256 × 256 |
| `sym_L3.png` | 256 × 256 | 410 × 410 |
| `sym_L3_blur.png` | 256 × 256 | 256 × 256 |
| `sym_L4.png` | 256 × 256 | 410 × 410 |
| `sym_L4_blur.png` | 256 × 256 | 256 × 256 |
| `sym_L5.png` | 256 × 256 | 410 × 410 |
| `sym_L5_blur.png` | 256 × 256 | 256 × 256 |
| `sym_S.png` | 256 × 256 | 410 × 410 |
| `sym_S_blur.png` | 256 × 256 | 256 × 256 |

### Salon & table

| File | Drawn at (units) | Shipped pixels |
|---|---|---|
| `bg_salon.jpg` | 1920 × 1080 | 2400 × 1350 |
| `bg_salon_p.jpg` | 1080 × 1920 | 1350 × 2400 |
| `bg_private.jpg` | 1920 × 1080 | 2400 × 1350 |
| `bg_private_p.jpg` | 1080 × 1920 | 1350 × 2400 |
| `curtain.png` | 560 × 1080 | 560 × 1080 |
| `valance.png` | 1920 × 120 | 1920 × 120 |
| `frame.png` | 724 × 484 | 2172 × 1452 |
| `felt.jpg` | 600 × 360 | 1500 × 900 |
| `reel_shade.png` | 600 × 360 | 600 × 360 |
| `logo.png` | 540 × 236 | 1350 × 590 |
| `logo_blank.png` | 540 × 236 | 1350 × 590 |
| `panel.png` | 640 × 420 | 1280 × 840 |
| `plaque.png` | 320 × 80 | 800 × 200 |
| `rail.png` | 16 × 240 | 32 × 480 |
| `rake.png` | 720 × 90 | 1440 × 180 |

### Win banners

| File | Drawn at (units) | Shipped pixels |
|---|---|---|
| `banner_big.png` | 1100 × 220 | 1650 × 330 |
| `banner_grand.png` | 1100 × 220 | 1650 × 330 |
| `banner_mega.png` | 1100 × 220 | 1650 × 330 |
| `banner_legendary.png` | 1100 × 220 | 1650 × 330 |
| `banner_max.png` | 1100 × 220 | 1650 × 330 |

### HUD controls

| File | Drawn at (units) | Shipped pixels |
|---|---|---|
| `btn_round.png` | 128 × 128 | 320 × 320 |
| `btn_buy.png` | 260 × 130 | 520 × 260 |
| `btn_buy_hunt.png` | 260 × 130 | 520 × 260 |
| `card.png` | 360 × 460 | 720 × 920 |
| `card_wide.png` | 640 × 250 | 1280 × 500 |
| `icon_highroller.png` | 256 × 256 | 512 × 512 |
| `icon_hunt.png` | 256 × 256 | 512 × 512 |
| `ribbon.png` | 320 × 72 | 640 × 144 |
| `spin_ring.png` | 200 × 200 | 500 × 500 |
| `spin_core.png` | 140 × 140 | 350 × 350 |
| `icon_spin.png` | 64 × 64 | 192 × 192 |
| `icon_stop.png` | 64 × 64 | 192 × 192 |
| `icon_auto.png` | 64 × 64 | 192 × 192 |
| `icon_turbo.png` | 64 × 64 | 192 × 192 |
| `icon_menu.png` | 64 × 64 | 192 × 192 |
| `icon_sound.png` | 64 × 64 | 192 × 192 |
| `icon_soundOff.png` | 64 × 64 | 192 × 192 |
| `icon_plus.png` | 64 × 64 | 192 × 192 |
| `icon_minus.png` | 64 × 64 | 192 × 192 |
| `icon_info.png` | 64 × 64 | 192 × 192 |
| `icon_rules.png` | 64 × 64 | 192 × 192 |
| `icon_settings.png` | 64 × 64 | 192 × 192 |
| `icon_close.png` | 64 × 64 | 192 × 192 |

### Effects

| File | Drawn at (units) | Shipped pixels |
|---|---|---|
| `fx_glow.png` | 256 × 256 | 256 × 256 |
| `fx_rouge.png` | 256 × 256 | 256 × 256 |
| `fx_glint.png` | 64 × 64 | 128 × 128 |
| `fx_ring.png` | 256 × 256 | 384 × 384 |
| `fx_ray.png` | 64 × 1024 | 32 × 512 |
| `fx_beam.png` | 64 × 32 | 64 × 32 |
| `fx_dot.png` | 64 × 64 | 128 × 128 |
| `fx_chip.png` | 96 × 96 | 192 × 192 |
| `fx_spot.png` | 512 × 1024 | 256 × 512 |
| `fx_sweep.png` | 512 × 160 | 512 × 160 |
| `fx_divider.png` | 24 × 360 | 48 × 720 |

## Symbol meanings

| ID | Symbol | Notes |
|---|---|---|
| W | Golden Chip (WILD) | substitutes for all but the Key; in free spins it locks in place |
| H1 | Roulette Wheel | top symbol |
| H2 | Brilliant Diamond | |
| H3 | Dice | ivory with rouge pips |
| H4 | Fan of Aces | |
| L1–L5 | A, K, Q, J, 10 | jewel enamel: emerald, rouge, sapphire, amethyst, amber |
| S | Golden Key (BONUS) | 3+ anywhere trigger free spins |

## Animation upgrade path

The engine (PixiJS 8 + pixi-svelte) also supports Spine 4.2 skeletons; animated symbols can be added later as `spine` assets in `src/game/assets.ts` and selected per state in `SYMBOL_INFO_MAP` (`src/game/constants.ts`).

## Audio

Audio is synthesized at runtime (`src/audio/`). A licensed file placed at `src/audio/override/<name>.mp3` (or .ogg/.m4a/.wav) replaces the matching synth sound; `music_base.*` / `music_private.*` replace the music. Names: `uiClick`, `spinPress`, `reelStart`, `reelStop`, `wildLand`, `keyLand`, `anticipation`, `lineTrace`, `winSmall`, `winNice`, `winGreat`, `countTick`, `countEnd`, `tierBig`, `tierGrand`, `tierMega`, `tierLegendary`, `tierMax`, `chipShower`, `freeSpinsIntro`, `chipLock`, `retrigger`, `bonusEnd`, `doorsOpen`, `curtains`. Previews of every synth sound: `design/audio-preview/`.
