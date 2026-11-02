# Gilded Salon

A 5x3, 20-line video slot for [Stake Engine](https://stake-engine.com), set in a 1920s Monte Carlo art-deco casino.
Free spins with sticky wilds, plus three bought features. Every mode has 96.50% RTP and a 10,000x max win.

| Mode | Cost | What it is |
|---|---|---|
| base | 1x | Normal spins. Free spins about 1 in 238. |
| bonus | 129x | Buy Free Spins: one spin that always lands 3 to 5 scatters. |
| super | 771x | Buy Super Free Spins: 12 free spins with 2 sticky wilds placed before the first spin. |
| hunt | 3x per spin | Bonus Hunt: free spins about 1 in 51. |

## Layout

| Path | Contents |
|---|---|
| `math-sdk/` | Stake Engine math SDK (MIT). The game is in `games/sticky_fruits/`. |
| `web-sdk/` | Stake Engine web SDK (MIT). The game is in `apps/sticky_fruits/`. |
| `upload/` | What is uploaded to Stake: `frontend/` (built game) and `math/` (index and lookup tables; see below for the books). |
| `design/` | Store art, mockups, art brief, audio previews. |
| `docs/` | Design specs and implementation plans. |

The game's internal ID is still `sticky_fruits`; only the player-facing name changed.

## Upstream SDK versions

Both SDKs are plain folders here, taken from Stake Engine's repositories at these commits:

- `web-sdk`: https://github.com/StakeEngine/web-sdk at `1843d60`
- `math-sdk`: https://github.com/StakeEngine/math-sdk at `a6dccd8`

Stake's six sample games (`web-sdk/apps/cluster`, `lines`, `number-picker`, `price`, `scatter`, `ways`) are left out; get them from the upstream repository if you need them. Run `pnpm install` (not `--frozen-lockfile`), because the lockfile still lists them.

Small local changes to the SDKs: `adapter-static` is pinned to 3.0.8 in four `web-sdk` packages (with `pnpm-lock.yaml`), and the math runs rewrote `math-sdk/optimization_program/src/setup.toml`.

## Math

```sh
cd math-sdk
python3 -m venv env && env/bin/pip install -r requirements.txt   # once
env/bin/python games/sticky_fruits/run.py                        # simulate, weight, verify
env/bin/python -m pytest games/sticky_fruits/tests               # head start + weighting tests
```

The books (`*.jsonl.zst`) are not in git: two are over GitHub's 100 MB limit. `run.py` regenerates them exactly; simulations are seeded per round. Add `"base": int(2e5)` and `"hunt": int(2e5)` to `num_sim_args` in `run.py` to rebuild those modes too. The figures for every mode are in `games/sticky_fruits/readme.txt`.

## Front end

```sh
cd web-sdk
pnpm install
cd apps/sticky_fruits
pnpm test                        # unit tests (vitest)
node tools/build.mjs             # production build -> build/
node tools/mock-rgs.mjs          # local Stake RGS mock + static server (https://localhost:3443)
node tools/e2e.mjs               # end-to-end scenarios against the mock
```

See `web-sdk/apps/sticky_fruits/tools/README.md` for the mock server, the e2e scenarios, and how to open the game locally.

## Licences

The Stake Engine SDKs are MIT-licensed, Copyright (c) 2025 Stake Engine. The game code, art and sound are original to this project. Fonts: Limelight and Josefin Sans (SIL Open Font License).
