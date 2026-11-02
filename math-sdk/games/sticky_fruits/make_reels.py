"""Generate reel strip CSVs from per-reel symbol counts.

Edit REEL_SETS and re-run to retune the game:
    python games/sticky_fruits/make_reels.py
"""

import os
import random

PAYING = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "L5"]


def counts(h1, h2, h3, h4, l1, l2, l3, l4, l5, w=0, s=0):
    return dict(zip(PAYING + ["W", "S"], [h1, h2, h3, h4, l1, l2, l3, l4, l5, w, s]))


# Minimum distance between two copies of the same symbol (cyclic).
# A gap of 3 means a 3-row window can never show two of them.
DEFAULT_GAPS = {"S": 3, "W": 3}

REEL_SETS = {
    "BR0": {
        "gaps": DEFAULT_GAPS,
        "reels": [
            counts(3, 4, 5, 6, 9, 10, 11, 13, 14, w=0, s=2),
            counts(3, 4, 5, 6, 9, 10, 11, 12, 13, w=2, s=2),
            counts(3, 4, 5, 6, 9, 10, 11, 12, 14, w=1, s=2),
            counts(3, 4, 5, 6, 9, 10, 11, 12, 13, w=2, s=2),
            counts(3, 4, 5, 6, 9, 10, 11, 13, 14, w=0, s=2),
        ],
    },
    "FR0": {
        "gaps": DEFAULT_GAPS,
        "reels": [counts(3, 3, 4, 6, 7, 8, 9, 9, 9, w=3, s=2) for _ in range(5)],
    },
    # Only used to generate max-win rounds for the optimizer
    "FRWCAP": {
        "gaps": {"S": 3},
        "reels": [counts(1, 1, 1, 2, 2, 2, 2, 3, 3, w=12, s=1) for _ in range(5)],
    },
    # Bonus Hunt base reels: BR0 plus scatters (4/3/4/3/4) and low fillers, 80 stops: free spins ~1 in 51. Must stay LAST: the strips are drawn from
    # one shared RNG, so adding a set before the others would reshuffle BR0/FR0/FRWCAP.
    "BR1": {
        "gaps": DEFAULT_GAPS,
        "reels": [
            counts(3, 4, 5, 6, 9, 10, 11, 13, 15, w=0, s=4),
            counts(3, 4, 5, 6, 9, 10, 11, 13, 14, w=2, s=3),
            counts(3, 4, 5, 6, 9, 10, 11, 12, 15, w=1, s=4),
            counts(3, 4, 5, 6, 9, 10, 11, 13, 14, w=2, s=3),
            counts(3, 4, 5, 6, 9, 10, 11, 13, 15, w=0, s=4),
        ],
    },
}


def violates(strip, idx, gaps):
    """True if the symbol at idx breaks a gap rule or makes a run of 3 identical symbols."""
    n = len(strip)
    sym = strip[idx]
    gap = gaps.get(sym)
    if gap:
        for d in range(1, gap):
            if strip[(idx + d) % n] == sym or strip[(idx - d) % n] == sym:
                return True
    else:
        for start in (idx - 2, idx - 1, idx):
            if all(strip[(start + k) % n] == sym for k in range(3)):
                return True
    return False


def build_strip(symbol_counts, gaps, rng, max_iters=200_000):
    strip = [sym for sym, c in symbol_counts.items() for _ in range(c)]
    rng.shuffle(strip)
    n = len(strip)
    for _ in range(max_iters):
        bad = [i for i in range(n) if violates(strip, i, gaps)]
        if not bad:
            return strip
        i = rng.choice(bad)
        j = rng.randrange(n)
        strip[i], strip[j] = strip[j], strip[i]
    raise RuntimeError(f"Could not satisfy reel constraints for {symbol_counts}")


def write_csv(path, strips):
    """SDK format: one column per reel, one row per stop."""
    with open(path, "w", encoding="UTF-8") as f:
        for stops in zip(*strips):
            f.write(",".join(stops) + "\n")


def main():
    rng = random.Random(20261002)
    reels_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reels")
    os.makedirs(reels_dir, exist_ok=True)
    for name, spec in REEL_SETS.items():
        strips = [build_strip(c, spec["gaps"], rng) for c in spec["reels"]]
        lengths = {len(s) for s in strips}
        assert len(lengths) == 1, f"{name}: all reels in a set must be the same length, got {lengths}"
        write_csv(os.path.join(reels_dir, f"{name}.csv"), strips)
        print(f"{name}: {len(strips)} reels x {lengths.pop()} stops")


if __name__ == "__main__":
    main()
