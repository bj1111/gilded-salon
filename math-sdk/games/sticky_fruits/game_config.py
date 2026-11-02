"""Sticky Fruits: 5x3, 20 paylines, free spins with sticky wilds."""

import os
from src.config.config import Config
from src.config.distributions import Distribution
from src.config.betmode import BetMode


class GameConfig(Config):

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        super().__init__()
        self.game_id = "sticky_fruits"
        self.provider_number = 0
        self.working_name = "Sticky Fruits"
        self.wincap = 10000.0
        self.win_type = "lines"
        self.rtp = 0.9650
        self.construct_paths()

        # Game Dimensions
        self.num_reels = 5
        self.num_rows = [3] * self.num_reels

        # Pays are multiples of the total bet. Every value is a multiple of 0.1x,
        # because the RGS only accepts round payouts in 0.1x increments.
        # H1 Seven, H2 Bell, H3 Bar, H4 Watermelon,
        # L1 Grapes, L2 Plum, L3 Orange, L4 Lemon, L5 Cherry
        self.paytable = {
            (5, "W"): 100,
            (4, "W"): 20,
            (3, "W"): 5,
            (5, "H1"): 100,
            (4, "H1"): 20,
            (3, "H1"): 5,
            (5, "H2"): 40,
            (4, "H2"): 10,
            (3, "H2"): 3,
            (5, "H3"): 30,
            (4, "H3"): 8,
            (3, "H3"): 2,
            (5, "H4"): 20,
            (4, "H4"): 5,
            (3, "H4"): 1.5,
            (5, "L1"): 10,
            (4, "L1"): 3,
            (3, "L1"): 1.2,
            (5, "L2"): 8,
            (4, "L2"): 2,
            (3, "L2"): 0.8,
            (5, "L3"): 6,
            (4, "L3"): 1.5,
            (3, "L3"): 0.6,
            (5, "L4"): 5,
            (4, "L4"): 1.2,
            (3, "L4"): 0.5,
            (5, "L5"): 4,
            (4, "L5"): 1,
            (3, "L5"): 0.4,
        }

        # Row index per reel (0 = top row)
        self.paylines = {
            1: [1, 1, 1, 1, 1],
            2: [0, 0, 0, 0, 0],
            3: [2, 2, 2, 2, 2],
            4: [0, 1, 2, 1, 0],
            5: [2, 1, 0, 1, 2],
            6: [0, 0, 1, 2, 2],
            7: [2, 2, 1, 0, 0],
            8: [1, 0, 1, 2, 1],
            9: [1, 2, 1, 0, 1],
            10: [0, 1, 1, 1, 2],
            11: [2, 1, 1, 1, 0],
            12: [0, 1, 0, 1, 2],
            13: [2, 1, 2, 1, 0],
            14: [1, 1, 0, 1, 1],
            15: [1, 1, 2, 1, 1],
            16: [0, 2, 1, 0, 2],
            17: [2, 0, 1, 2, 0],
            18: [0, 0, 2, 0, 0],
            19: [2, 2, 0, 2, 2],
            20: [1, 0, 0, 0, 1],
        }

        self.include_padding = True
        self.special_symbols = {"wild": ["W"], "scatter": ["S"]}

        # 3+ scatters anywhere start free spins. During free spins, 3+ scatters add 5 more.
        self.freespin_triggers = {
            self.basegame_type: {3: 8, 4: 10, 5: 12},
            self.freegame_type: {3: 5, 4: 5, 5: 5},
        }
        self.anticipation_triggers = {
            self.basegame_type: min(self.freespin_triggers[self.basegame_type].keys()) - 1,
            self.freegame_type: min(self.freespin_triggers[self.freegame_type].keys()) - 1,
        }

        # Reels
        reels = {"BR0": "BR0.csv", "BR1": "BR1.csv", "FR0": "FR0.csv", "WCAP": "FRWCAP.csv"}
        self.reels = {}
        for r, f in reels.items():
            self.reels[r] = self.read_reels_csv(os.path.join(self.reels_path, f))

        self.padding_reels[self.basegame_type] = self.reels["BR0"]
        self.padding_reels[self.freegame_type] = self.reels["FR0"]

        freegame_condition = {
            "reel_weights": {
                self.basegame_type: {"BR0": 1},
                self.freegame_type: {"FR0": 1},
            },
            "scatter_triggers": {3: 50, 4: 5, 5: 1},
            "force_wincap": False,
            "force_freegame": True,
        }

        basegame_condition = {
            "reel_weights": {self.basegame_type: {"BR0": 1}},
            "force_wincap": False,
            "force_freegame": False,
        }

        wincap_condition = {
            "reel_weights": {
                self.basegame_type: {"BR0": 1},
                self.freegame_type: {"FR0": 1, "WCAP": 5},
            },
            "scatter_triggers": {4: 1, 5: 2},
            "force_wincap": True,
            "force_freegame": True,
        }

        zerowin_condition = {
            "reel_weights": {self.basegame_type: {"BR0": 1}},
            "force_wincap": False,
            "force_freegame": False,
        }

        # Bought rounds: one base spin that always triggers free spins.
        bonus_freegame_condition = {**freegame_condition}
        super_freegame_condition = {**freegame_condition, "scatter_triggers": {5: 1}, "start_sticky_wilds": 2}
        super_wincap_condition = {**wincap_condition, "scatter_triggers": {5: 1}, "start_sticky_wilds": 2}

        # Bonus Hunt: the base game on BR1, which carries more scatters.
        def on_hunt_reels(condition):
            weights = {**condition["reel_weights"], self.basegame_type: {"BR1": 1}}
            return {**condition, "reel_weights": weights}

        self.bet_modes = [
            BetMode(
                name="base",
                cost=1.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=self.wincap,
                        conditions=wincap_condition,
                    ),
                    Distribution(criteria="freegame", quota=0.1, conditions=freegame_condition),
                    Distribution(criteria="0", quota=0.4, win_criteria=0.0, conditions=zerowin_condition),
                    Distribution(criteria="basegame", quota=0.5, conditions=basegame_condition),
                ],
            ),
            # Costs of the bought modes are placeholders: natural_weights.py solves the
            # whole-number price from the simulated rounds before configs are written.
            BetMode(
                name="bonus",
                cost=125.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=False,
                is_buybonus=True,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=self.wincap,
                        conditions=wincap_condition,
                    ),
                    Distribution(criteria="freegame", quota=0.999, conditions=bonus_freegame_condition),
                ],
            ),
            BetMode(
                name="super",
                cost=650.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=False,
                is_buybonus=True,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=self.wincap,
                        conditions=super_wincap_condition,
                    ),
                    Distribution(criteria="freegame", quota=0.999, conditions=super_freegame_condition),
                ],
            ),
            BetMode(
                name="hunt",
                cost=3.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=self.wincap,
                        conditions=on_hunt_reels(wincap_condition),
                    ),
                    Distribution(criteria="freegame", quota=0.1, conditions=on_hunt_reels(freegame_condition)),
                    Distribution(criteria="0", quota=0.4, win_criteria=0.0, conditions=on_hunt_reels(zerowin_condition)),
                    Distribution(criteria="basegame", quota=0.5, conditions=on_hunt_reels(basegame_condition)),
                ],
            ),
        ]
