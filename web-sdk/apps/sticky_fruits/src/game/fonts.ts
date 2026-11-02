// Pixi measures text once with whatever font is ready, so text must not render before the
// bundled fonts (declared in app.html) have loaded.
const FACES = ["400 40px 'Limelight'", "600 40px 'Josefin Sans'", "700 40px 'Josefin Sans'"];

export const loadFonts = async () => {
	if (typeof document === 'undefined' || !document.fonts) return;
	try {
		await Promise.all(FACES.map((face) => document.fonts.load(face)));
	} catch (error) {
		// a missing font only costs typography, never the game
		console.error(error);
	}
};
