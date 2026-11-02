"""Unforced Monte Carlo of the game, for tuning reels and paytable before optimization.

The SDK's create_books() forces outcomes per distribution criteria, so its RTP only
becomes meaningful after the optimizer reweights it. This script plays rounds the
way a real player would see them, using the exact same GameState logic.

    python games/sticky_fruits/natural_sim.py --spins 2000000 --bonus 20000
"""

import argparse
import time
from multiprocessing import Pool

import numpy as np

from game_config import GameConfig
from gamestate import GameState
from src.events.events import reveal_event


class NaturalGameState(GameState):
    """Same rules as GameState, without criteria-based forcing or repeats."""

    def draw_board(self, emit_event=True, trigger_symbol="scatter"):
        self.create_board_reelstrips()
        if self.gametype == self.config.basegame_type:
            self.base_scatters = self.count_special_symbols("scatter")
        if emit_event:
            reveal_event(self)

    def check_repeat(self):
        self.repeat = False

    def imprint_wins(self):
        self.temp_wins = []
        self.results.append(
            (
                self.final_win,
                self.book.basegame_wins,
                self.book.freegame_wins,
                self.triggered_freegame,
                self.base_scatters,
            )
        )

    def run_bonus_only(self, sim, num_scatters):
        """Play one free-spin round as if triggered by num_scatters."""
        self.reset_seed(sim)
        self.reset_book()
        self.tot_fs = self.config.freespin_triggers[self.config.basegame_type][num_scatters]
        initial_fs = self.tot_fs
        self.run_freespin()
        win = min(self.win_manager.freegame_wins, self.config.wincap)
        self.results.append((win, len(self.sticky_wilds), self.tot_fs > initial_fs, self.fs))


BASE_REELS = "BR0"


def set_base_reels(name):
    """Pool initializer: play the base game on another reel set (e.g. BR1 for Bonus Hunt)."""
    global BASE_REELS
    BASE_REELS = name


def make_state():
    config = GameConfig()
    config.reels["BR0"] = config.reels[BASE_REELS]
    gs = NaturalGameState(config)
    gs.betmode = "base"
    gs.criteria = "freegame"  # the one criteria with both base and free reel weights
    gs.results = []
    return gs


def run_base_chunk(args):
    start, stop = args
    gs = make_state()
    for sim in range(start, stop):
        gs.run_spin(sim)
    return gs.results


def run_bonus_chunk(args):
    start, stop, num_scatters = args
    gs = make_state()
    for sim in range(start, stop):
        gs.run_bonus_only(sim, num_scatters)
    return gs.results


def chunks(total, workers, offset=0):
    size = -(-total // (workers * 4))
    return [(offset + i, offset + min(i + size, total)) for i in range(0, total, size)]


def one_in(p):
    return f"1 in {1 / p:,.1f}" if p > 0 else "never"


def report_base(rows, wincap):
    a = np.array(rows, dtype=float)
    final, base, free, trig, scat = a[:, 0], a[:, 1], a[:, 2], a[:, 3].astype(bool), a[:, 4]
    n = len(a)
    print(f"\n=== Natural play: {n:,} base spins ===")
    print(f"RTP total     {final.mean():.4f}   (base {base.mean():.4f} / free spins {free.mean():.4f})")
    print(f"Std dev       {final.std():.2f}x")
    print(f"Any win       {one_in((final > 0).mean())}")
    print(f"Base-game win {one_in((base > 0).mean())}")
    print(f"Wins < bet    {(final[final > 0] < 1).mean():.1%} of winning spins")
    print(f"Free spins    {one_in(trig.mean())}   ({trig.sum():,} triggers)")
    if trig.any():
        print(f"  avg bonus   {free[trig].mean():.1f}x   median {np.median(free[trig]):.1f}x")
    two = (scat == 2) & ~trig
    print(f"2-scatter     {one_in(two.mean())}   ({two.sum() / max(trig.sum(), 1):.1f} per trigger)")
    print(f"Max seen      {final.max():,.1f}x   (cap {wincap:,.0f}x)")
    # Same volatility limits as utils/rgs_verification.py (wincap rounds are added later by the optimizer)
    tail = np.sort(final)[-max(1, int(n * 0.001)) :]
    print(f"etl40b        {final[final >= 40].sum() / n:.4f}   (limit 0.9: RTP share from wins >= 40x)")
    print(f"cvar 99.9%    {tail.mean():.1f}x   (limit 800: average of the top 0.1% of rounds)")
    edges = [0, 1e-9, 1, 2, 5, 20, 100, 500, 1000, 5000, wincap, np.inf]
    labels = ["0", "(0,1)", "[1,2)", "[2,5)", "[5,20)", "[20,100)", "[100,500)", "[500,1k)", "[1k,5k)", "[5k,cap)", "cap"]
    print("Win buckets (x bet):")
    for lo, hi, label in zip(edges[:-1], edges[1:], labels):
        mask = (final >= lo) & (final < hi) if label != "cap" else final >= wincap
        if label == "0":
            mask = final == 0
        p = mask.mean()
        print(f"  {label:>10}  {p:9.5%}  {one_in(p):>16}  rtp {final[mask].sum() / n:.4f}")


def report_bonus(rows_by_k):
    print("\n=== Free spins only ===")
    for k, rows in rows_by_k.items():
        a = np.array(rows, dtype=float)
        wins = a[:, 0]
        print(
            f"{k} scatters: avg {wins.mean():7.1f}x  median {np.median(wins):6.1f}x  "
            f"p90 {np.percentile(wins, 90):7.1f}x  p99 {np.percentile(wins, 99):8.1f}x  max {wins.max():8.1f}x  "
            f"| sticky wilds {a[:, 1].mean():.1f}  retrigger {a[:, 2].mean():.1%}  spins {a[:, 3].mean():.1f}"
        )
        print(
            f"           P(<10x) {(wins < 10).mean():.1%}  P(>=100x) {(wins >= 100).mean():.2%}  "
            f"P(>=1000x) {(wins >= 1000).mean():.3%}"
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--spins", type=int, default=1_000_000)
    parser.add_argument("--bonus", type=int, default=10_000, help="free-spin rounds per trigger size")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--base-reels", default="BR0", help="base reel set to play (BR1 = Bonus Hunt)")
    args = parser.parse_args()

    config = GameConfig()
    start = time.time()
    with Pool(args.workers, initializer=set_base_reels, initargs=(args.base_reels,)) as pool:
        if args.spins > 0:
            rows = [r for part in pool.map(run_base_chunk, chunks(args.spins, args.workers)) for r in part]
            report_base(rows, config.wincap)
        if args.bonus > 0:
            rows_by_k = {}
            for k in config.freespin_triggers[config.basegame_type]:
                jobs = [(a, b, k) for a, b in chunks(args.bonus, args.workers, offset=10_000_000 * k)]
                rows_by_k[k] = [r for part in pool.map(run_bonus_chunk, jobs) for r in part]
            report_bonus(rows_by_k)
    print(f"\n({time.time() - start:.0f}s)")


if __name__ == "__main__":
    main()
