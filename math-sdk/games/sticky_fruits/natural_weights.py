"""Weight every simulated round by its natural probability instead of using the Rust optimizer.

The optimizer reshapes win distributions toward its own targets (mean-to-median bands,
Gaussian fences). For this game that turned most base wins into sub-bet wins and
almost removed 500x+ bonuses, which no longer matches what the reels show. Here:

  * Rounds inside a criteria are natural draws conditioned on that criteria, so each
    gets an equal share of the criteria's probability.
  * Free-spin rounds were forced with a 50:5:1 split of 3/4/5 scatters; they are
    re-weighted to the exact natural split computed from the base reelstrip.
  * The max-win share is fixed (WINCAP_ONE_IN).
  * The base-game hit rate is the one free value, solved so total RTP == config RTP.

Bought modes have no base game to solve, so each gets a different free value:
  * bonus (Buy Free Spins): the natural 3/4/5-scatter split given a trigger, with the
    3-scatter share solved for RTP (4:5 kept natural, 3s within 10% of natural).
  * super (5 scatters + 2 opening wilds): the max-win share is solved for RTP.
  * hunt (Bonus Hunt, cost 3): the base algorithm on its own reels (BR1).
Buy prices are whole multiples of the bet, solved from the simulated round values.

    python games/sticky_fruits/natural_weights.py   (after run.py has written books)
"""

import csv
import io
import json
import os
from collections import defaultdict

import zstandard

WINCAP_ONE_IN = 10_000_000
TOTAL_WEIGHT = 10**18  # well inside uint64
MIX_TOLERANCE = 0.10  # bought 3-scatter share may differ from natural by at most 10%
SUPER_WINCAP_BOUNDS = (1 / 200_000, 1 / 2_000)

# base reel set each mode's trigger spin is drawn from
MODE_REELS = {"base": "BR0", "bonus": "BR0", "super": "BR0", "hunt": "BR1"}


def solve_buy_price(mean_value, rtp):
    """Whole-number price (x bet) for a bought round worth mean_value on average."""
    return round(mean_value / rtp)


def solve_trigger_mix(means, natural, wincap, target):
    """Trigger mix for Buy Free Spins: P(k scatters) summing to 1 - P(max win).

    Keeps the natural 4:5 ratio and solves the 3-scatter share so the round's value equals
    target. means/natural are keyed by scatter count; wincap is (probability, value).
    """
    wincap_prob, wincap_value = wincap
    rest = 1 - wincap_prob
    upper = {k: p for k, p in natural.items() if k != 3}
    upper_total = sum(upper.values())
    upper_mean = sum(upper[k] * means[k] for k in upper) / upper_total
    # target = p3 * m3 + (rest - p3) * upper_mean + wincap_prob * wincap_value
    p3 = (target - wincap_prob * wincap_value - rest * upper_mean) / (means[3] - upper_mean)
    natural_p3 = natural[3] / sum(natural.values())
    assert abs(p3 / rest - natural_p3) / natural_p3 <= MIX_TOLERANCE, (p3 / rest, natural_p3)
    mix = {3: p3}
    for k, p in upper.items():
        mix[k] = (rest - p3) * p / upper_total
    return mix


def solve_super(mean_value, wincap, rtp):
    """Price and max-win share for Super Free Spins (one trigger size, so the max-win share is free).

    The price is the smallest whole number that leaves at least the minimum max-win share.
    """
    low, high = SUPER_WINCAP_BOUNDS
    cost = -(-(mean_value + low * (wincap - mean_value)) // rtp)
    cost = int(cost)
    wincap_prob = (rtp * cost - mean_value) / (wincap - mean_value)
    assert low <= wincap_prob <= high, wincap_prob
    return cost, wincap_prob


def natural_scatter_probabilities(config, reels="BR0"):
    """P(exactly k scatters) on a base reveal, from a base reelstrip.

    Valid because make_reels.py keeps scatters at least num_rows apart, so a reel
    shows at most one scatter and P(scatter on reel) = count * rows / length.
    """
    strips = config.reels[reels]
    dist = [1.0]
    for reel, strip in enumerate(strips):
        p = strip.count("S") * config.num_rows[reel] / len(strip)
        new = [0.0] * (len(dist) + 1)
        for k, pk in enumerate(dist):
            new[k] += pk * (1 - p)
            new[k + 1] += pk * p
        dist = new
    return {k: pk for k, pk in enumerate(dist)}


def read_books(path):
    """Yield (id, criteria, payout_multiplier_in_cents, trigger_scatter_count) for each book."""
    with open(path, "rb") as f:
        reader = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f), encoding="utf-8")
        for line in reader:
            book = json.loads(line)
            scatters = None
            for event in book["events"]:
                if event["type"] == "freeSpinTrigger":
                    scatters = len(event["positions"])
                    break
            yield book["id"], book["criteria"], book["payoutMultiplier"], scatters


def group_books(books):
    groups = defaultdict(list)
    for book_id, criteria, payout, scatters in books:
        key = (criteria, scatters) if criteria == "freegame" else (criteria, None)
        groups[key].append((book_id, payout / 100))
    return groups


def base_group_probabilities(config, mode, mean_pay):
    """Base and Bonus Hunt: natural trigger odds from the mode's reels, base hit rate solved."""
    cost = config_mode(config, mode).get_cost()
    scatter_probs = natural_scatter_probabilities(config, MODE_REELS[mode])
    triggers = sorted(config.freespin_triggers[config.basegame_type])
    group_prob = {("freegame", k): scatter_probs[k] for k in triggers}
    # more triggers per spin means proportionally more max wins
    trigger_ratio = sum(scatter_probs[k] for k in triggers) / sum(
        natural_scatter_probabilities(config, "BR0")[k] for k in triggers
    )
    group_prob[("wincap", None)] = trigger_ratio / WINCAP_ONE_IN
    fixed = sum(prob * mean_pay(key) for key, prob in group_prob.items())
    basegame_prob = (config.rtp * cost - fixed) / mean_pay(("basegame", None))
    group_prob[("basegame", None)] = basegame_prob
    group_prob[("0", None)] = 1 - sum(group_prob.values())
    assert 0 < basegame_prob < 1 and group_prob[("0", None)] > 0, group_prob
    return group_prob, cost


def bonus_group_probabilities(config, mean_pay):
    """Buy Free Spins: natural split of a BR0 trigger, 3-scatter share solved; price solved."""
    scatter_probs = natural_scatter_probabilities(config, "BR0")
    triggers = sorted(config.freespin_triggers[config.basegame_type])
    trigger_prob = sum(scatter_probs[k] for k in triggers)
    natural = {k: scatter_probs[k] / trigger_prob for k in triggers}
    means = {k: mean_pay(("freegame", k)) for k in triggers}
    wincap = (1 / (WINCAP_ONE_IN * trigger_prob), config.wincap)
    value = sum(natural[k] * means[k] for k in triggers) * (1 - wincap[0]) + wincap[0] * wincap[1]
    cost = solve_buy_price(value, config.rtp)
    mix = solve_trigger_mix(means, natural, wincap, config.rtp * cost)
    group_prob = {("freegame", k): p for k, p in mix.items()}
    group_prob[("wincap", None)] = wincap[0]
    return group_prob, cost


def super_group_probabilities(config, mean_pay):
    """Buy Super Free Spins: one trigger size; max-win share solved; price solved."""
    cost, wincap_prob = solve_super(mean_pay(("freegame", 5)), config.wincap, config.rtp)
    return {("freegame", 5): 1 - wincap_prob, ("wincap", None): wincap_prob}, cost


def config_mode(config, mode):
    return next(bm for bm in config.bet_modes if bm.get_name() == mode)


def write_natural_lookup(config, mode="base"):
    """Write lookUpTable_<mode>_0.csv with natural weights; sets the mode's cost for buy modes."""
    books_path = os.path.join(config.publish_path, f"books_{mode}.jsonl.zst")
    lut_path = os.path.join(config.publish_path, f"lookUpTable_{mode}_0.csv")
    books = list(read_books(books_path))
    groups = group_books(books)

    def mean_pay(key):
        return sum(p for _, p in groups[key]) / len(groups[key])

    if mode in ("base", "hunt"):
        group_prob, cost = base_group_probabilities(config, mode, mean_pay)
    elif mode == "bonus":
        group_prob, cost = bonus_group_probabilities(config, mean_pay)
    elif mode == "super":
        group_prob, cost = super_group_probabilities(config, mean_pay)
    else:
        raise ValueError(f"no weighting for mode {mode}")
    config_mode(config, mode)._cost = float(cost)
    assert set(group_prob) == set(groups), f"criteria mismatch: {set(group_prob) ^ set(groups)}"

    weights = {}
    for key, members in groups.items():
        per_book = round(group_prob[key] * TOTAL_WEIGHT / len(members))
        assert per_book >= 1, f"{key}: weight underflow"
        for book_id, _ in members:
            weights[book_id] = per_book

    with open(lut_path, "w", encoding="UTF-8", newline="") as f:
        writer = csv.writer(f)
        for book_id, _, payout, _ in sorted(books):
            writer.writerow([book_id, weights[book_id], payout])

    total = sum(weights.values())
    rtp = sum(weights[i] * p for i, _, p, _ in books) / total / 100 / cost
    trigger = sum(prob for key, prob in group_prob.items() if key[0] == "freegame")
    wincap_prob = group_prob[("wincap", None)]
    print(f"\nNatural weights written to {lut_path}")
    print(f"  mode {mode}: cost {cost}x, RTP {rtp:.5f} (target {config.rtp})")
    print(f"  free spins 1 in {1 / trigger:.1f}, max win 1 in {1 / wincap_prob:,.0f}")
    for key in sorted(k for k in group_prob if k[0] == "freegame"):
        print(f"    {key[1]} scatters: share {group_prob[key]:.5f}, avg {mean_pay(key):.1f}x, {len(groups[key]):,} books")
    if ("basegame", None) in group_prob:
        print(f"  base-game win 1 in {1 / group_prob[('basegame', None)]:.3f} (solved), avg {mean_pay(('basegame', None)):.2f}x")
    return {"rtp": rtp, "cost": cost, "trigger_one_in": 1 / trigger, "wincap_one_in": 1 / wincap_prob}


if __name__ == "__main__":
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from game_config import GameConfig

    config = GameConfig()
    for name in sys.argv[1:] or ["base"]:
        write_natural_lookup(config, name)
