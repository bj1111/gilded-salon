# Sticky Fruits

5 reels x 3 rows, 20 fixed paylines, classic fruit theme, high volatility.
Max win 10,000x. Target RTP 96.5%.

Symbols (pays are x total bet for 3 / 4 / 5 of a kind):
  W   Wild        5 / 20 / 100   substitutes for all except Scatter
  H1  Seven       5 / 20 / 100
  H2  Bell        3 / 10 / 40
  H3  Bar         2 / 8 / 30
  H4  Watermelon  1.5 / 5 / 20
  L1  Grapes      1.2 / 3 / 10
  L2  Plum        0.8 / 2 / 8
  L3  Orange      0.6 / 1.5 / 6
  L4  Lemon       0.5 / 1.2 / 5
  L5  Cherry      0.4 / 1 / 4
  S   Scatter     no pay, triggers free spins

Basegame:
Wilds appear on reels 2, 3 and 4 only.
3 / 4 / 5 Scatters anywhere award 8 / 10 / 12 free spins.

FreeGame:
Separate reelstrip with Wilds on all reels.
Every Wild that lands becomes sticky and stays in place for the rest of the round.
3+ Scatters award 5 more spins. A Scatter covered by a sticky Wild does not count.

Events added on top of the standard lines events:
  newStickyWilds  sent after a freegame reveal, lists Wilds that just landed
                  (rows include the padding offset) and the running sticky total.
                  The reveal board already shows earlier sticky Wilds in place.

Published math (200k books, natural weights, all RGS volatility checks pass):
  RTP           96.50% (base ~44.8%, free spins ~51.6%, max win 0.1%)
  Hit rate      1 in 3.67
  Free spins    1 in 238, average 119x (3 scatters) / 223x (4) / 437x (5)
  Max win       10,000x, 1 in 10,000,000
  Std dev       16.5x
  etl40b 0.49 (limit 0.9), cvar 371x (limit 800)
  Wins below bet: 40% of winning spins

Bought features (published next to base; base books and lookup table are unchanged):
  mode   type                 sims   cost   RTP     max win odds     std dev   notes
  bonus  Buy Free Spins       100k   129x   96.50%  1 in 41,955      1.69x     one base spin that always lands 3-5
                                                                               scatters (3/4/5 split within 10% of natural)
  super  Buy Super Free Spins 100k   771x   96.50%  1 in 13,297      1.03x     always 5 scatters (12 spins); 2 wilds
                                                                               lock on random cells before the first spin
  hunt   Bonus Hunt           200k   3x     96.50%  1 in 2,132,628   11.76x    base game on BR1 (more scatters): free
                                                                               spins 1 in 50.8 vs 1 in 238; any win 1 in 3.20
  (std dev in multiples of each mode's cost.) Prices are solved by natural_weights.py from the
  simulated rounds (whole multiples of the bet). Super's max-win share is the one value solved
  for its RTP; its odds sit above the few natural cap hits in the sample because 771x is the
  smallest whole price that leaves a non-negative share.
  The SDK's "3-star volatility" check warns on hunt (etl40b 1.91 > 0.9): it sums that figure in
  base-bet units without dividing by the mode's cost. Per unit cost it is 0.64, inside the limit.

Weighting:
run.py defaults to weighting = "natural" (natural_weights.py). Each round gets its real
probability: rounds within a criteria share it equally, forced free-spin rounds are
re-weighted to the reelstrip's natural 3/4/5-scatter odds, and the base hit rate is
solved so RTP is exact (1 in 3.72 vs 1 in 3.69 in natural play).
weighting = "optimizer" uses the SDK's Rust optimizer instead. With its default
parameters it pushed sub-bet wins from 40% to 91% of wins and made 500x+ bonuses about
40x rarer than the reels produce.

Tuning workflow:
  1. Edit symbol counts in make_reels.py or pays in game_config.py
  2. python games/sticky_fruits/make_reels.py
  3. python games/sticky_fruits/natural_sim.py --spins 2000000 --bonus 30000
  4. Keep game_optimization.py targets in sync (only used with weighting = "optimizer")
  5. python games/sticky_fruits/run.py
     Publish files land in library/publish_files/. run.py simulates the modes in num_sim_args
     (bonus, super, hunt); base is only re-simulated if "base" is added there.
  6. python -m pytest games/sticky_fruits/tests   (head start + weighting solvers)

Keep the base reelstrip's natural trigger rate equal to the published free-spin rate.
If the bonus is made rarer than the reels produce, 2-scatter boards show up more often
than real triggers would explain, which reads as engineered near-misses.
