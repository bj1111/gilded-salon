from src.executables.executables import Executables


class GameCalculations(Executables):

    def update_anticipation(self):
        """Recompute scatter anticipation after sticky wilds cover part of the board.

        A covered scatter no longer counts, and anticipation is cleared when every
        remaining reel is fully covered, since no scatter could land there.
        """
        trigger = self.config.anticipation_triggers[self.gametype]
        anticipation = [0] * self.config.num_reels
        scatter_count = 0
        first_reel = -1
        for reel, _ in enumerate(self.board):
            scatter_count += sum(1 for sym in self.board[reel] if sym.check_attribute("scatter"))
            if scatter_count >= trigger and first_reel == -1:
                first_reel = reel + 1

        if first_reel > -1:
            open_reel_after = any(
                any((reel, row) not in self.sticky_wilds for row in range(self.config.num_rows[reel]))
                for reel in range(first_reel, self.config.num_reels)
            )
            if open_reel_after:
                for count, reel in enumerate(range(first_reel, self.config.num_reels), start=1):
                    anticipation[reel] = count

        self.anticipation = anticipation
