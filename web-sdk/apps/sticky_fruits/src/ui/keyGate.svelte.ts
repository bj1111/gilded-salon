// When the Space bar may act on the game. Space must never start a paid round by accident:
// - after entering from the loader with Space, it is ignored until the key has been released;
// - while a full-screen presentation (big win, free-spin intro/outro) is up, Space only skips it.
export const keyGate = $state({
	spaceReleased: true,
	overlays: 0,
});

export const spaceBlocked = () => !keyGate.spaceReleased || keyGate.overlays > 0;

// for full-screen presentations: call on show, call the returned function on hide
export const holdSpace = () => {
	keyGate.overlays += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		keyGate.overlays = Math.max(0, keyGate.overlays - 1);
	};
};
