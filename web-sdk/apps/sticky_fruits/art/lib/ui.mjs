// HUD controls: brass buttons, the spin dial and ivory icon glyphs.

export const buttonRound = () => ({
	w: 128,
	h: 128,
	body: `
	<g filter="url(#dsS)">
		<circle cx="64" cy="64" r="60" fill="url(#goldD)"/>
		<circle cx="64" cy="64" r="54" fill="url(#lacquerR)"/>
		<circle cx="64" cy="64" r="49" fill="none" stroke="#C99A45" stroke-opacity=".38" stroke-width="1.2"/>
		<path d="M 22 50 A 44 44 0 0 1 70 21" stroke="#fff" stroke-opacity=".28" stroke-width="3" fill="none" stroke-linecap="round"/>
	</g>`,
});

// Outer grooved brass ring of the spin dial (rotates while spinning)
export const spinRing = () => {
	const grooves = Array.from({ length: 48 }, (_, i) => {
		const a = (i / 48) * 2 * Math.PI;
		const p = (r) => `${(100 + r * Math.cos(a)).toFixed(2)} ${(100 + r * Math.sin(a)).toFixed(2)}`;
		return `<path d="M ${p(70)} L ${p(91)}" stroke="#5E4413" stroke-width="2.2" opacity=".55"/>`;
	}).join('');
	return {
		w: 200,
		h: 200,
		body: `<g filter="url(#ds)"><circle cx="100" cy="100" r="94" fill="url(#goldD)"/>${grooves}<circle cx="100" cy="100" r="94" fill="none" stroke="#FFF4CF" stroke-opacity=".5" stroke-width="1.5"/></g>`,
	};
};

// Lacquer core of the spin dial (stays still, carries the glyph)
export const spinCore = () => ({
	w: 140,
	h: 140,
	body: `
	<circle cx="70" cy="70" r="66" fill="url(#lacquerR)" stroke="url(#gold)" stroke-width="3"/>
	<circle cx="70" cy="70" r="58" fill="none" stroke="#C99A45" stroke-opacity=".4" stroke-width="1.2"/>
	<path d="M 18 52 A 56 56 0 0 1 78 14" stroke="#fff" stroke-opacity=".3" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
});

const glyph = (inner) => ({
	w: 64,
	h: 64,
	// the invisible rect gives every glyph a full-size bounding box; a lone horizontal line
	// (minus) would otherwise have zero height and its drop-shadow filter would hide it
	body: `<g filter="url(#dsS)" fill="none" stroke="#F5ECD9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><rect width="64" height="64" stroke="none"/>${inner}</g>`,
});

export const icons = {
	icon_spin: glyph(`<path d="M 14 26 A 20 20 0 0 1 49 22"/><path d="M 50 38 A 20 20 0 0 1 15 42"/><path d="M 44 12 L 51 23 L 39 26"/><path d="M 20 52 L 13 41 L 25 38"/>`),
	icon_stop: glyph(`<rect x="18" y="18" width="28" height="28" rx="4" fill="#F5ECD9"/>`),
	icon_auto: glyph(`<path d="M 19 18 A 20 20 0 1 0 46 20"/><path d="M 40 10 L 47 21 L 35 23"/><path d="M 27 23 L 41 32 L 27 41 Z" fill="#F5ECD9" stroke-width="2"/>`),
	icon_turbo: glyph(`<path d="M 36 8 L 18 36 H 31 L 27 56 L 46 26 H 33 Z" fill="#F5ECD9" stroke-width="2"/>`),
	icon_menu: glyph(`<path d="M 15 20 H 49"/><path d="M 15 32 H 49"/><path d="M 15 44 H 49"/>`),
	icon_sound: glyph(`<path d="M 12 26 H 21 L 32 16 V 48 L 21 38 H 12 Z" fill="#F5ECD9" stroke-width="2"/><path d="M 40 24 A 11 11 0 0 1 40 40"/><path d="M 46 17 A 20 20 0 0 1 46 47"/>`),
	icon_soundOff: glyph(`<path d="M 12 26 H 21 L 32 16 V 48 L 21 38 H 12 Z" fill="#F5ECD9" stroke-width="2"/><path d="M 40 25 L 52 39"/><path d="M 52 25 L 40 39"/>`),
	icon_plus: glyph(`<path d="M 32 16 V 48"/><path d="M 16 32 H 48"/>`),
	icon_minus: glyph(`<path d="M 16 32 H 48"/>`),
	icon_info: glyph(`<circle cx="32" cy="32" r="22"/><path d="M 32 29 V 45"/><circle cx="32" cy="20" r="1.5" stroke-width="5"/>`),
	icon_rules: glyph(`<rect x="16" y="12" width="32" height="40" rx="4"/><path d="M 23 24 H 41"/><path d="M 23 32 H 41"/><path d="M 23 40 H 35"/>`),
	icon_settings: glyph(`<circle cx="32" cy="32" r="8"/>${Array.from({ length: 8 }, (_, i) => `<path d="M 32 10 V 16" transform="rotate(${i * 45} 32 32)"/>`).join('')}<circle cx="32" cy="32" r="16"/>`),
	icon_close: glyph(`<path d="M 18 18 L 46 46"/><path d="M 46 18 L 18 46"/>`),
};
