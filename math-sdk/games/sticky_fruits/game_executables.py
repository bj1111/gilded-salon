import random

from game_calculations import GameCalculations
from game_events import new_sticky_wilds_event
from src.calculations.lines import Lines


class GameExecutables(GameCalculations):

    def evaluate_lines_board(self):
        """Populate win-data, record wins, transmit events."""
        self.win_data = Lines.get_lines(self.board, self.config, global_multiplier=self.global_multiplier)
        Lines.record_lines_wins(self)
        self.win_manager.update_spinwin(self.win_data["totalWin"])
        Lines.emit_linewin_events(self)

    def apply_sticky_wilds(self):
        """Place every sticky wild on the freshly drawn board, then refresh scatter counts and anticipation."""
        for reel, row in self.sticky_wilds:
            self.board[reel][row] = self.create_symbol("W")
        self.get_special_symbols_on_board()
        self.update_anticipation()

    def lock_opening_wilds(self):
        """Super Free Spins head start: lock wilds on random cells before the first free spin."""
        count = self.get_current_distribution_conditions().get("start_sticky_wilds", 0)
        if count <= 0:
            return
        cells = [(reel, row) for reel in range(self.config.num_reels) for row in range(self.config.num_rows[reel])]
        self.sticky_wilds = random.sample(cells, count)
        new_sticky_wilds_event(self, self.sticky_wilds)

    def collect_new_sticky_wilds(self):
        """Wilds that landed on this reveal become sticky for the rest of the round."""
        new_wilds = []
        for reel, _ in enumerate(self.board):
            for row, _ in enumerate(self.board[reel]):
                if self.board[reel][row].check_attribute("wild") and (reel, row) not in self.sticky_wilds:
                    new_wilds.append((reel, row))
        if len(new_wilds) > 0:
            self.sticky_wilds.extend(new_wilds)
            new_sticky_wilds_event(self, new_wilds)
