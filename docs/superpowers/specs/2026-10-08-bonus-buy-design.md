# Gilded Salon — Bonus Buy and Bonus Hunt

Date: 2026-10-08. Status: design approved in conversation ("do as you see fit"); this spec records it.

## 1. Intent

The owner wants Gilded Salon to offer bought features the way Hacksaw's *The Luxe* does on Stake: buy
the bonus outright, buy a premium version of it, or switch on a "Bonus Hunt" mode that costs more per
spin and triggers the bonus more often. Success means:

- three purchasable options, each with real simulated math at 96.50% RTP and the 10,000x cap;
- a bought bonus is presented exactly like a won one (same Private Room, chips, retriggers);
- the existing base-game math files stay byte-identical;
- the upload passes Stake's checks and the existing test suites, plus new scenarios for each mode.

Said by the owner: all three options; Super Free Spins = "head start" (chips already locked).
Assumed (owner delegated): prices, names, button placement, Bonus Hunt cost 3x, all of section 4.

## 2. The offer

| Mode key | Player name | SDK type | What happens | Cost (x bet) |
|---|---|---|---|---|
| `base` | — | default | unchanged | 1 |
| `bonus` | Buy Free Spins — *The Private Room* | `buy` | one spin that always lands 3–5 keys (8/10/12 free spins) | ~125, set by simulation |
| `super` | Buy Super Free Spins — *The High-Roller Room* | `buy` | one spin that always lands 5 keys (12 free spins); before the first free spin, 2 wild chips lock on random cells | ~600–700, set by simulation |
| `hunt` | Bonus Hunt | `activate` | every spin costs 3x; free spins about 1 in 50 instead of 1 in 238 | 3 |

Free-spin rules are identical in every mode: sticky wilds, +5 spins on 3+ keys, a key under a sticky
wild does not count, round stops at 10,000x.

## 3. Math (`math-sdk/games/sticky_fruits`)

### 3.1 Config
- `game_config.py`: three new `BetMode`s after `base`.
  - `bonus`: `is_buybonus=True`, `is_feature=False`, distributions `wincap` (quota 0.001,
    `force_wincap`, FR0/WCAP reels as base) and `freegame` (`force_freegame`, BR0 trigger spin,
    `scatter_triggers` 3/4/5 at the natural ratio, then fine-tuned for RTP — see 3.3).
  - `super`: as `bonus` but `scatter_triggers {5: 1}` and a new condition `start_sticky_wilds: 2`.
  - `hunt`: `is_buybonus=False`, `is_feature=True` (the SDK keeps it selected between spins),
    the same four distributions as `base` but on a new base reel strip `BR1`.
- Every mode: `rtp=0.965`, `max_win=10000`.

### 3.2 Game logic
- `gamestate.run_freespin`: after `reset_fs_spin()` and `sticky_wilds = []`, if the current
  distribution has `start_sticky_wilds = n`, pick `n` distinct cells uniformly (seeded RNG of the
  round), add them to `sticky_wilds`, and send `new_sticky_wilds_event` before the first
  `updateFreeSpin`. The first reveal then shows them in place through the existing
  `apply_sticky_wilds`. Nothing else changes.
- `make_reels.py`: add `BR1` = `BR0` with extra `S` stops, chosen so the natural trigger rate is about
  1 in 50 (measured with `natural_sim.py`). Reel lengths may change; wild placement rules stay.

### 3.3 Weights and prices (`natural_weights.py`)
- Extend the natural weighting to every mode. Each round keeps its real probability; within a mode,
  rounds of a criteria share it equally.
- `bonus` / `super`: average round value V is measured from the simulated books. Price
  `cost = round(V / 0.965)` (super rounded to the nearest 10). The last bit of RTP is closed by
  adjusting the 3/4/5-key trigger mix (bonus) or the wincap quota (super) so RTP is exactly 96.50%.
- `hunt`: same solving as `base` (base hit rate solved so RTP is exact at cost 3). If the reels give
  more than 96.50% at cost 3, remove key stops from `BR1` and re-measure; the published trigger rate
  must equal the reels' natural rate (readme rule against engineered near-misses).

### 3.4 Run and publish
- `run.py`: `num_sim_args = {"bonus": 5e4, "super": 5e4, "hunt": 2e5}`; base is not re-simulated.
  `generate_configs` rewrites `index.json` and the config files for all four modes. Base's
  `books_base.jsonl.zst` and `lookUpTable_base_0.csv` must keep their recorded hashes.
- Run `execute_all_tests` (Stake's RGS checks) on every mode. Update `readme.txt` with each mode's
  RTP, hit rate, cost, max win odds, std dev.
- `export_frontend.py` regenerates `config.ts` for the web app (betModes now has four entries).

## 4. Frontend (`web-sdk/apps/sticky_fruits`)

### 4.1 Mode metadata
- `game/context.ts`: replace the "base only" override with `betModes.ts`, which builds
  `stateMeta.betModeMeta` for BASE, BONUS, SUPER, HUNT from `config.betModes` (cost from the math,
  never hard-coded) and our copy (titles, dialog text).
- `buy/buyRules.ts` (pure, unit-tested): `buyPrice(mode, bet)`, `canAfford(mode, bet, balance)`
  (buy modes need `bet × cost ≤ balance`; the SDK only checks this for `activate`),
  `buyAvailable(jurisdiction, replay)` (false when `disabledBuyFeature` or in replay),
  `huntActive(activeBetModeKey)`.

### 4.2 HUD
- **BONUS button** (gold plaque, key icon, reads "BUY BONUS"; social "FEATURES"):
  - desktop / tablet / landscape: left of the reel frame, vertically centred on the board;
  - portrait: left of the WIN plaque.
  - Hidden when `buyAvailable` is false. Disabled unless idle. New slot in `layout.ts`; existing
    layout tests extended (on screen, no overlap, ≥44 px on phones).
- **Bonus Hunt on**: the button reads "HUNT ON", with a rouge ring that pulses slowly; the BET
  field shows the per-spin cost ("BET $1.00 · ×3 = $3.00"); a small "BONUS HUNT" ribbon hangs under
  the crest. Pressing the button while Hunt is on opens the menu, where Hunt can be switched off.

### 4.3 Buy menu (`buy/BuyMenu.svelte`, Pixi, salon style)
- Lacquer panel with three cards: The Private Room, The High-Roller Room, Bonus Hunt. Each card has
  an icon, two lines of description, the price as multiple and money ("125× · $125.00") and a button
  (BUY / BUY / TURN ON|TURN OFF).
- Bet −/+ inside the menu (same bet levels as the HUD); prices update live.
- A card the player cannot afford is dimmed and reads "Balance too low".
- BUY opens a confirm step: "Buy The Private Room for $125.00?" CONFIRM / BACK. CONFIRM sets
  `activeBetModeKey`, closes the menu and starts the bet. TURN ON for Hunt needs no confirm (no money
  moves until the next spin, whose cost is on the BET field).
- Esc / tap outside closes the menu; Space is blocked while it is open (keyGate overlay).

### 4.4 Round flow
- After a bought round ends (`bonus`, `super`), the mode returns to BASE (verify the SDK does this;
  if not, `actor.ts` does it on round end). Autoplay never runs a buy mode; it may run with Hunt on.
- `super` rounds: `newStickyWilds` arrives before the first free spin; the existing chip-drop
  presentation runs over the trigger board. No new event types.
- Resume (`ResumeBet.svelte`) already restores `betToResume.mode`. Replay takes `mode` from the URL.

### 4.5 Copy and rules
- `copyData.ts`: menu strings for both regular and social mode; social removes buy, bought, purchase
  and cost wording (the existing restricted-phrase table, plus a test that scans the new strings).
- Rules modal: a "Bonus features" section with each option, its cost in multiples of the bet, and
  "RTP 96.50%" for every mode; plus that a bought round is the same as a triggered one.

## 5. Testing
- Math: Stake RGS checks per mode; base file hashes unchanged; spot-check books of each mode
  (`super` books start with exactly 2 `newStickyWilds` before the first reveal).
- Unit (vitest): `buyRules`, mode metadata built from config, layout slots, copy scan.
- Integrity harness: sample books from `bonus`, `super`, `hunt` (board = last reveal, WIN = finalWin,
  no leftover chips).
- e2e on the production build:
  - buy bonus: debit `bet × cost`, round ends, mode back to BASE, balance exact;
  - buy super: 2 chips before the first free spin, same bookkeeping;
  - hunt: 5 spins at 3x debit, switch off, next spin at 1x;
  - balance too low: card dimmed, no `/wallet/play`;
  - `--disabledBuyFeature`: no button;
  - replay `mode=super`; resume a bought round mid-bonus;
  - all 8 sizes with the new button.

## 6. Out of scope
- New art beyond the button, menu panel, three card icons and the Hunt ribbon (drawn with the
  existing art pipeline).
- Different free-spin rules per mode beyond the Super head start.
- Changing base-game math.

## 7. Risks
- **Upload size:** three new modes add roughly 25–45 MB of compressed books. That is inside Stake's
  limits as far as we know; check it in Stake Studio during upload.
- **Fit with the trigger mix:** the bonus price might not land on a round number without straying far
  from the natural 3/4/5 mix. If so, use the nearest whole number that keeps the mix within ±10% of
  natural.
- **The SDK's own buy UI** is never shown: the HTML `ModalBuyBonus` from components-ui-html is not
  mounted.
