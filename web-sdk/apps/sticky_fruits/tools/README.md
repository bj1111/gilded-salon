# sticky_fruits test tools

Two dependency-free Node scripts (Node 22+, tested on 26):

- `mock-rgs.mjs` is a local HTTPS mock of the Stake Engine RGS that also serves a static build.
- `e2e.mjs` is a playwright-core harness that drives the built game against the mock in Chrome.

## mock-rgs.mjs

```sh
cd web-sdk/apps/sticky_fruits
pnpm --filter sticky_fruits build                    # or point --static at any build dir
node tools/mock-rgs.mjs                              # https://localhost:3443
node tools/mock-rgs.mjs --static ../../../upload/frontend --port 0 --seed 7
```

The server prints a ready-to-open URL:

```
https://localhost:<port>/index.html?sessionID=dev-session&rgs_url=localhost:<port>&lang=en&currency=USD&device=desktop
```

The certificate is self-signed and generated with `openssl` at startup, so accept it once in the browser. The frontend always calls `https://${rgs_url}…`, which is why the mock serves HTTPS. CORS is open, so `pnpm dev` (http://localhost:3002) can also use `rgs_url=localhost:<port>` once the cert has been accepted.

Replay mode: `index.html?replay=true&game=sticky_fruits&version=1&mode=base&event=<bookId>&amount=1000000&rgs_url=localhost:<port>&lang=en&currency=USD&device=desktop`

### Endpoints

All amounts are integers ×1,000,000 (RGS.md, "Understanding Money").

| Endpoint | Behaviour |
| --- | --- |
| `POST /wallet/authenticate {sessionID, language}` | Creates the session wallet on first use (`--balance`, default 1000). Returns `{balance:{amount,currency}, config:{minBet,maxBet,stepBet,defaultBetLevel,betLevels,betModes:{},jurisdiction:{…}}, round?}`. `round` is the active round if there is one (resume), otherwise the last completed round. |
| `POST /wallet/balance {sessionID}` | Returns `{balance}`. |
| `POST /wallet/play {sessionID, amount, mode, currency}` | Validates the request first. `amount` must be an integer in `[minBet,maxBet]` and divisible by `stepBet`, otherwise `ERR_VAL`. `mode` must be in `index.json` (case-insensitive), otherwise `ERR_VAL`. A play while a round is active returns `ERR_BE`, and a balance below `amount × cost` returns `ERR_IPB`. A valid play debits `amount × cost` and picks a book: forced ids come first, otherwise a weighted pick from the lookup table (seeded splitmix64). It returns `{balance, round:{betID, roundID, amount, payout, payoutMultiplier (= book/100), active, mode, event:null, state: book.events}}`. `active` is `payoutMultiplier > 0`. A zero-pay round is closed immediately, matching how the SDK's `noWin` path never calls end-round. |
| `POST /wallet/end-round {sessionID}` | Credits `payout = amount × bookMultiplier / 100` and closes the round. Returns `{balance}`. Without an active round it returns `ERR_VAL`. |
| `POST /bet/event {sessionID, event}` | Stores `event` on the active round, which is used for resume. Returns `{event}`. |
| `GET /bet/replay/{game}/{version}/{mode}/{event}` | `event` is the book id. Returns `{payoutMultiplier, costMultiplier, state}`. |

Errors are HTTP 400 (or 500) with `{error: "<CODE>", message}`. This is the shape `ModalError.svelte` renders.

The mock decompresses the books with `zlib.zstdDecompressSync`. If that is unavailable it falls back to the `zstd` CLI, then to python `zstandard`. Books are loaded lazily on first use (`--preload` loads them at startup) and indexed by id.

### Flags

`--port` (0 = random), `--host`, `--static`, `--library`, `--seed`, `--force 12,34` (book ids used by the next plays, in order), `--balance`, `--currency`, `--betLevels 0.1,0.2,…`, `--defaultBetLevel`, `--minBet/--maxBet/--stepBet`, `--latency <ms>`, the jurisdiction flags (`--social`, `--disabledTurbo`, `--disabledAutoplay`, `--disabledSlamstop`, `--disabledSpacebar`, `--disabledFullscreen`, `--disabledSuperTurbo`, `--disabledBuyFeature`, `--displayNetPosition`, `--displayRTP`, `--displaySessionTimer`, `--minimumRoundDuration <ms>`), `--cert/--key`, `--preload`, `--quietStatic`, `--quiet`. Run `--help` for the full list.

### Admin API (for tests)

| Endpoint | Purpose |
| --- | --- |
| `GET /__admin/state[?sessionID=&since=<seq>]` | Sessions (balance, active and last round), violations, and the RGS call log, one entry per call with `seq`, timing, status and a round summary. |
| `POST /__admin/force {ids:[…], append?}` | Queue forced books. |
| `POST /__admin/config {latency?, jurisdiction?, startBalance?, balance?:{sessionID, amount}}` | Change runtime settings. |
| `POST /__admin/reset` | Reset all state. |
| `GET /__admin/find?has=freeSpinRetrigger&not=wincap&minPayout=15&maxPayout=&limit=10` | Search books by event types and payout (in ×). |
| `GET /__admin/book/{mode}/{id}` | Return a raw book. |

Violations recorded: `playWhileActive`, `endRoundWithoutActive`, `concurrentPlay` (more than one `/wallet/play` in flight for a session).

## e2e.mjs

```sh
cd web-sdk/apps/sticky_fruits
node tools/e2e.mjs                                    # all scenarios against ./build
node tools/e2e.mjs --static ../../../upload/frontend  # a specific build
node tools/e2e.mjs --only a,b --spins 5 --headed
```

The harness starts the mock on a random port and opens Chrome (`/Applications/Google Chrome.app`, override with `--chrome`) with `ignoreHTTPSErrors`. Requests to anything other than localhost are recorded and blocked; `--allowExternal` lets them through but still records them.

Each run writes `mock-rgs.log`, `summary.json` and one screenshot folder per scenario to `--out` (default: the session scratchpad `e2e/` dir). The script exits non-zero if any scenario fails.

| Scenario | What it checks |
| --- | --- |
| `a` boot | Load, tap the loading screen, canvas present. There must be no page errors, no console errors and no non-localhost requests. |
| `b` spins | Space N times (`--spins`, default 20). Waits for play and end-round, tapping bonus panels. Checks the call order (no play while active, no end-round without a round, at most one play in flight) and that the balance equals start − Σbet + Σpayout. |
| `c` rapid | 30 Space presses and clicks in 3 s with 250 ms RGS latency. Same checks as `b`. |
| `d` bonus | Forces a retrigger bonus, a wincap bonus and a base win of 15× or more. Taps through each and checks the payout credited. |
| `e` resume | Forces a bonus and reloads after the first free-spin `/bet/event`. authenticate must return the active round with the stored event, the game must resume from that event, and end-round must be called with no new play. |
| `f` replay | Replay URL params. The replay endpoint must be called, with no wallet or `/bet/event` calls. |
| `g` sizes | Loads at 8 viewports (portrait sizes use `device=mobile` with touch emulation), takes an idle screenshot and checks for page scroll. |
| `h` buy | Opens the BUY BONUS menu, buys The Private Room and confirms. The play must be `mode=bonus` with a debit of bet × cost and a free-spin trigger. Then 3 Space rounds must all be `mode=base` (no repeat buy), and the balance must be exact. |
| `i` super | Buys The High-Roller Room. The book must lock 2 wilds before the first free spin. Reloads mid-bonus: the round resumes with no new play and ends with exact bookkeeping. |
| `j` hunt | Turns Bonus Hunt on: 5 spins at `mode=hunt` with a 3× debit. Turns it off: the next spin is `mode=base` at 1×. Then with 4.00 balance it forces a losing hunt spin and checks that Space sends nothing once 3× can't be covered. |
| `k` low | Balance 50: The Private Room card reads BALANCE TOO LOW and clicking BUY + CONFIRM sends no play. |
| `l` nobuy | Sets jurisdiction `disabledBuyFeature`: no BUY BONUS button and no play from the menu positions. |
| `f2` replay-modes | Replays a `super` and a `hunt` book from the URL `mode`. Only the replay endpoint may be called. |

Buy-menu click positions (scenarios h–l) are for the 1366 × 768 viewport; see `BUY_UI` in `e2e.mjs`.

Console errors raised while the page loads only fail `a`. Every scenario fails on errors raised during play.
