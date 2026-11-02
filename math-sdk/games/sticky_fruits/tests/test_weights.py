"""Per-mode natural weighting: buy prices, trigger mix and reel sets."""

import os
import sys

import pytest

GAME_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, GAME_DIR)

from natural_weights import MODE_REELS, solve_buy_price, solve_trigger_mix, solve_super  # noqa: E402

RTP = 0.965


def test_buy_price_is_value_over_rtp_rounded():
    assert solve_buy_price(120.7, RTP) == 125


def test_trigger_mix_hits_rtp_and_stays_near_natural():
    natural = {3: 0.90, 4: 0.08, 5: 0.02}
    means = {3: 100.0, 4: 200.0, 5: 400.0}
    wincap = (1 / 40_000, 10_000.0)
    value = sum(natural[k] * means[k] for k in natural) * (1 - wincap[0]) + wincap[0] * wincap[1]
    cost = solve_buy_price(value, RTP)
    mix = solve_trigger_mix(means, natural, wincap, RTP * cost)
    assert sum(mix.values()) == pytest.approx(1 - wincap[0], abs=1e-12)
    rtp = (sum(mix[k] * means[k] for k in mix) + wincap[0] * wincap[1]) / cost
    assert rtp == pytest.approx(RTP, abs=1e-9)
    assert mix[4] / mix[5] == pytest.approx(natural[4] / natural[5])
    assert abs(mix[3] / (1 - wincap[0]) - natural[3]) / natural[3] <= 0.10


def test_trigger_mix_refuses_a_mix_far_from_natural():
    natural = {3: 0.90, 4: 0.08, 5: 0.02}
    means = {3: 100.0, 4: 200.0, 5: 400.0}
    with pytest.raises(AssertionError):
        solve_trigger_mix(means, natural, (0.0, 10_000.0), RTP * 200)


def test_super_price_leaves_room_for_a_bounded_max_win_share():
    cost, wincap_prob = solve_super(mean_value=620.0, wincap=10_000.0, rtp=RTP)
    assert isinstance(cost, int)
    assert (1 - wincap_prob) * 620.0 + wincap_prob * 10_000.0 == pytest.approx(RTP * cost, abs=1e-9)
    assert 1 / 200_000 <= wincap_prob <= 1 / 2_000


def test_bonus_hunt_plays_its_own_reels():
    assert MODE_REELS == {"base": "BR0", "bonus": "BR0", "super": "BR0", "hunt": "BR1"}
