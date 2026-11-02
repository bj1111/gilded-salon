// Shared SVG vocabulary for the Gilded Salon art: palette, gradients, filters and deco shapes.
// Every asset document gets the same <defs>, so ids like url(#gold) work everywhere.

export const PALETTE = {
	lacquer0: '#0B0C0E',
	lacquer1: '#1A1C21',
	felt0: '#1B5E4D',
	felt1: '#061C15',
	gold0: '#FFF4CF',
	gold1: '#F0D592',
	gold2: '#C99A45',
	gold3: '#8C6A2E',
	ivory: '#F5ECD9',
	rouge: '#B3122E',
};

const GOLD_STOPS = `<stop offset="0" stop-color="#FFF4CF"/><stop offset=".22" stop-color="#F0D592"/><stop offset=".47" stop-color="#C99A45"/><stop offset=".6" stop-color="#8C6A2E"/><stop offset=".8" stop-color="#E6C77F"/><stop offset="1" stop-color="#9A7433"/>`;
const lin = (id, stops, x2 = 0, y2 = 1) =>
	`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
export const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) =>
	`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
		.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
		.join('')}</radialGradient>`;
const enamel = (id, hi, mid, lo) =>
	lin(id, `<stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/>`);

export const DEFS = `
${lin('gold', GOLD_STOPS)}${lin('goldD', GOLD_STOPS, 1, 1)}${lin('goldH', GOLD_STOPS, 1, 0)}
${rad('ivoryR', [[0, '#FFFDF6'], [0.55, '#F5ECD9'], [1, '#CBBB98']], 0.35, 0.3, 0.9)}
${rad('lacquerR', [[0, '#2A2C33'], [1, '#0B0C0E']], 0.4, 0.3, 0.8)}
${rad('rougeR', [[0, '#FF6074'], [0.5, '#B3122E'], [1, '#4A0410']], 0.38, 0.3, 0.85)}
${enamel('enEmerald', '#6BEFBA', '#119464', '#043A24')}${enamel('enRouge', '#FF7C8D', '#C9183F', '#520513')}
${enamel('enSapphire', '#93C0FF', '#2860E0', '#0A1F5C')}${enamel('enAmethyst', '#DCAEFF', '#8A3BD9', '#36105F')}
${enamel('enAmber', '#FFD892', '#E88E22', '#6B3507')}
${rad('felt', [[0, '#1E6553'], [0.6, '#10443A'], [1, '#061C15']], 0.5, 0.45, 0.78)}
${rad('glowGold', [[0, '#FFE9A8', 0.9], [0.4, '#F0C766', 0.35], [1, '#F0C766', 0]])}
${rad('glowRouge', [[0, '#FF6074', 0.75], [0.45, '#B3122E', 0.32], [1, '#B3122E', 0]])}
${rad('glowWarm', [[0, '#FFE2A0', 0.55], [0.5, '#C99A45', 0.12], [1, '#C99A45', 0]])}
${rad('vign', [[0, '#000', 0], [0.68, '#000', 0.15], [1, '#000', 0.8]], 0.5, 0.45, 0.75)}
${rad('innerVign', [[0, '#000', 0], [0.75, '#000', 0.1], [1, '#000', 0.55]], 0.5, 0.5, 0.72)}
${rad('shadowBlob', [[0, '#000', 0.55], [1, '#000', 0]])}
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060A16"/><stop offset=".7" stop-color="#15244A"/><stop offset="1" stop-color="#2A3A60"/></linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101C36"/><stop offset="1" stop-color="#04070E"/></linearGradient>
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14151A"/><stop offset=".6" stop-color="#0E0F12"/><stop offset="1" stop-color="#08090B"/></linearGradient>
<linearGradient id="rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22242B"/><stop offset=".22" stop-color="#131418"/><stop offset="1" stop-color="#07080A"/></linearGradient>
<linearGradient id="velvet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2E040C"/><stop offset=".18" stop-color="#8E1129"/><stop offset=".34" stop-color="#4A0713"/><stop offset=".55" stop-color="#A3172F"/><stop offset=".74" stop-color="#55081A"/><stop offset=".9" stop-color="#93132C"/><stop offset="1" stop-color="#2E040C"/></linearGradient>
<linearGradient id="velvetShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
<linearGradient id="shadeV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".16" stop-color="#000" stop-opacity="0"/><stop offset=".84" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>
<filter id="ds" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".6"/></filter>
<filter id="dsS" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".55"/></filter>
<filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="blur20" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
<filter id="motionV" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="0 10"/></filter>
<filter id="baize" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .14 0"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/></filter>
<filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="topHalf"><rect x="0" y="0" width="256" height="122"/></clipPath>
`;

// Wraps a body in a complete SVG document of the given size (in art units).
export const doc = (w, h, body) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${DEFS}</defs>${body}</svg>`;

// ---------------------------------------------------------------- shapes

export const SUIT = {
	heart: 'M50 88 C 20 65, 4 46, 4 30 C 4 14, 18 4, 31 4 C 41 4, 47 10, 50 17 C 53 10, 59 4, 69 4 C 82 4, 96 14, 96 30 C 96 46, 80 65, 50 88 Z',
	spade: 'M50 4 C 80 30, 96 44, 96 60 C 96 74, 84 82, 72 82 C 62 82, 55 77, 52 70 C 53 80, 57 88, 66 96 L 34 96 C 43 88, 47 80, 48 70 C 45 77, 38 82, 28 82 C 16 82, 4 74, 4 60 C 4 44, 20 30, 50 4 Z',
	diamond: 'M50 2 L 88 50 L 50 98 L 12 50 Z',
	club: 'M50 6 a 20 20 0 1 1 -0.1 0 Z M27 38 a 20 20 0 1 1 -0.1 0 Z M73 38 a 20 20 0 1 1 -0.1 0 Z M46 58 C 46 76, 40 86, 31 96 L 69 96 C 60 86, 54 76, 54 58 Z',
};

export const suit = (name, x, y, s, fill) =>
	`<path d="${SUIT[name]}" transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" fill="${fill}"/>`;

// Four-point star glint
export const glint = (x, y, s, o = 1) =>
	`<g transform="translate(${x} ${y})" opacity="${o}"><path d="M0 ${-s} C ${s * 0.12} ${-s * 0.12}, ${s * 0.12} ${-s * 0.12}, ${s} 0 C ${s * 0.12} ${s * 0.12}, ${s * 0.12} ${s * 0.12}, 0 ${s} C ${-s * 0.12} ${s * 0.12}, ${-s * 0.12} ${s * 0.12}, ${-s} 0 C ${-s * 0.12} ${-s * 0.12}, ${-s * 0.12} ${-s * 0.12}, 0 ${-s} Z" fill="#FFF8E0"/><circle r="${s * 0.18}" fill="#fff"/></g>`;

// Art-deco quarter fan; opens toward +x/+y before rotation
export const fan = (x, y, r, rot, n = 7, stroke = 'url(#gold)', w = 2) => {
	const rays = Array.from({ length: n }, (_, i) => {
		const a = (i / (n - 1)) * (Math.PI / 2);
		return `<line x1="0" y1="0" x2="${(r * Math.cos(a)).toFixed(1)}" y2="${(r * Math.sin(a)).toFixed(1)}"/>`;
	}).join('');
	return `<g transform="translate(${x} ${y}) rotate(${rot})" stroke="${stroke}" stroke-width="${w}" fill="none"><path d="M ${r} 0 A ${r} ${r} 0 0 1 0 ${r}"/><path d="M ${r * 0.62} 0 A ${r * 0.62} ${r * 0.62} 0 0 1 0 ${r * 0.62}"/>${rays}</g>`;
};

// Rectangle with stepped (notched) deco corners
export const stepRect = (x, y, w, h, n) =>
	`M${x + n} ${y} H${x + w - n} V${y + n} H${x + w} V${y + h - n} H${x + w - n} V${y + h} H${x + n} V${y + h - n} H${x} V${y + n} H${x + n} Z`;

// Half sunburst (upper semicircle of rays) centred at x,y
export const sunburst = (x, y, r, n = 19, w = 3) =>
	Array.from({ length: n }, (_, i) => {
		const a = Math.PI + (i / (n - 1)) * Math.PI;
		return `<line x1="${x}" y1="${y}" x2="${(x + r * Math.cos(a)).toFixed(1)}" y2="${(y + r * Math.sin(a)).toFixed(1)}" stroke="url(#gold)" stroke-width="${i % 2 ? w / 2 : w}" opacity="${i % 2 ? 0.5 : 0.85}"/>`;
	}).join('');
