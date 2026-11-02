"""Super Free Spins head start: wild chips locked before the first free spin."""

import os
import sys

GAME_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, GAME_DIR)

from game_config import GameConfig  # noqa: E402
from gamestate import GameState  # noqa: E402


def play_freegame_round(sim, start_sticky_wilds):
    """Play one base-mode 'freegame' round with the head-start condition patched in."""
    gs = GameState(GameConfig())
    gs.betmode = "base"
    gs.criteria = "freegame"
    conditions = dict(gs.get_current_distribution_conditions())
    if start_sticky_wilds:
        conditions["start_sticky_wilds"] = start_sticky_wilds
    gs.get_current_distribution_conditions = lambda: conditions
    gs.run_spin(sim)
    return gs.book.events


def first_index(events, event_type):
    return next(i for i, e in enumerate(events) if e["type"] == event_type)


def test_head_start_locks_two_wilds_before_the_first_free_spin():
    events = play_freegame_round(sim=7, start_sticky_wilds=2)
    opening = first_index(events, "newStickyWilds")
    assert opening < first_index(events, "updateFreeSpin")
    wilds = events[opening]["newWilds"]
    cells = {(w["reel"], w["row"]) for w in wilds}
    assert len(wilds) == 2 and len(cells) == 2
    assert all(0 <= reel < 5 and 1 <= row <= 3 for reel, row in cells)
    assert events[opening]["totalStickyWilds"] == 2

    first_free_reveal = next(e for e in events if e["type"] == "reveal" and e["gameType"] == "freegame")
    for reel, row in cells:
        assert first_free_reveal["board"][reel][row]["name"] == "W"


def test_normal_free_spins_have_no_opening_wilds():
    events = play_freegame_round(sim=7, start_sticky_wilds=0)
    sticky = [i for i, e in enumerate(events) if e["type"] == "newStickyWilds"]
    assert not sticky or sticky[0] > first_index(events, "updateFreeSpin")
