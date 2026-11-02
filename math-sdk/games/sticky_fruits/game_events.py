"""Events specific to sticky wilds."""

NEW_STICKY_WILDS = "newStickyWilds"


def new_sticky_wilds_event(gamestate, new_wilds: list) -> None:
    """Sent after the reveal: wilds that just landed and will now stay for the rest of the round."""
    row_offset = 1 if gamestate.config.include_padding else 0
    event = {
        "index": len(gamestate.book.events),
        "type": NEW_STICKY_WILDS,
        "newWilds": [{"reel": reel, "row": row + row_offset} for reel, row in new_wilds],
        "totalStickyWilds": len(gamestate.sticky_wilds),
    }
    gamestate.book.add_event(event)
