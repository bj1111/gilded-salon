// Reel symbols, drawn in a 256 x 256 box with a shared top-left key light and gold rim language.
import { fan, glint, stepRect, suit } from './defs.mjs';

const S = {};

// WILD: Golden Chip
S.W = `
	<circle cx="128" cy="128" r="124" fill="url(#glowGold)" opacity=".5"/>
	<g filter="url(#ds)">
		<circle cx="128" cy="128" r="108" fill="url(#goldD)"/>
		${Array.from({ length: 8 }, (_, i) => `<g transform="rotate(${i * 45 + 22.5} 128 128)"><rect x="115" y="22" width="26" height="28" rx="3" fill="#121317" stroke="url(#gold)" stroke-width="2"/></g>`).join('')}
		<circle cx="128" cy="128" r="81" fill="none" stroke="#6B4F1F" stroke-width="3" stroke-dasharray="6 6"/>
		<circle cx="128" cy="128" r="73" fill="url(#lacquerR)" stroke="url(#gold)" stroke-width="4"/>
		${Array.from({ length: 24 }, (_, i) => `<line x1="128" y1="128" x2="${(128 + 70 * Math.cos((i * Math.PI) / 12)).toFixed(1)}" y2="${(128 + 70 * Math.sin((i * Math.PI) / 12)).toFixed(1)}" stroke="#C99A45" stroke-opacity=".13" stroke-width="2"/>`).join('')}
		<text x="128" y="147" text-anchor="middle" font-family="Limelight" font-size="52" fill="url(#gold)" stroke="#3B2A0C" stroke-width="1.5" letter-spacing="1">WILD</text>
		<path d="M 46 92 A 88 88 0 0 1 150 42" stroke="#fff" stroke-opacity=".35" stroke-width="5" fill="none" stroke-linecap="round"/>
	</g>
	${glint(207, 56, 16)}`;

// H1: Roulette Wheel
S.H1 = (() => {
	const n = 37, r0 = 72, r1 = 100;
	const p = (r, a) => `${(128 + r * Math.cos(a)).toFixed(2)} ${(128 + r * Math.sin(a)).toFixed(2)}`;
	let pockets = '';
	for (let i = 0; i < n; i++) {
		const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI;
		const fill = i === 0 ? '#0E7A52' : i % 2 ? '#B3122E' : '#141416';
		pockets += `<path d="M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z" fill="${fill}" stroke="#C99A45" stroke-width="1.2"/>`;
	}
	const arms = [0, 90, 180, 270]
		.map((d) => `<g transform="rotate(${d + 20} 128 128)"><rect x="124" y="70" width="8" height="58" rx="4" fill="url(#gold)"/><circle cx="128" cy="68" r="8" fill="url(#gold)"/></g>`)
		.join('');
	const ball = p(86, -0.9).split(' ');
	return `
	<g filter="url(#ds)">
		<circle cx="128" cy="128" r="119" fill="url(#lacquerR)" stroke="url(#goldD)" stroke-width="8"/>
		<circle cx="128" cy="128" r="104" fill="none" stroke="url(#gold)" stroke-width="3"/>
		${pockets}
		<circle cx="128" cy="128" r="72" fill="url(#goldD)"/>
		<circle cx="128" cy="128" r="56" fill="#8C6A2E" opacity=".45"/>
		${Array.from({ length: 16 }, (_, i) => `<line x1="128" y1="128" x2="${(128 + 70 * Math.cos((i * Math.PI) / 8)).toFixed(1)}" y2="${(128 + 70 * Math.sin((i * Math.PI) / 8)).toFixed(1)}" stroke="#FFF4CF" stroke-opacity=".25" stroke-width="1.5"/>`).join('')}
		${arms}
		<circle cx="128" cy="128" r="16" fill="url(#gold)" stroke="#6B4F1F" stroke-width="2"/>
		<circle cx="${ball[0]}" cy="${ball[1]}" r="8" fill="url(#ivoryR)" stroke="#8a7a5a" stroke-width=".8"/>
		<ellipse cx="96" cy="72" rx="60" ry="26" fill="#fff" opacity=".12" transform="rotate(-30 96 72)"/>
	</g>`;
})();

// H2: Brilliant Diamond
S.H2 = (() => {
	const G = [[22, 100], [74, 100], [128, 100], [182, 100], [234, 100]];
	const T0 = [78, 54], Tm = [128, 54], T1 = [178, 54], P = [128, 226];
	const poly = (pts, fill, o = 1) => `<polygon points="${pts.map((pt) => pt.join(',')).join(' ')}" fill="${fill}" opacity="${o}"/>`;
	return `
	<circle cx="128" cy="130" r="120" fill="url(#glowGold)" opacity=".22"/>
	<g filter="url(#ds)">
		${poly([G[0], T0, G[1]], '#DDF1FF')}${poly([T0, Tm, G[2], G[1]], '#FFFFFF')}${poly([Tm, T1, G[3], G[2]], '#C8E7FF')}${poly([T1, G[4], G[3]], '#8FC3EE')}
		${poly([G[0], G[1], P], '#9DCBF0')}${poly([G[1], G[2], P], '#F4FBFF')}${poly([G[2], G[3], P], '#B5DCF7')}${poly([G[3], G[4], P], '#5E8FC0')}
		${poly([G[1], [101, 100], P], '#FFD9F2', 0.55)}${poly([[155, 100], G[3], P], '#D7FFF6', 0.5)}
		<polygon points="${[G[0], T0, T1, G[4], P].map((pt) => pt.join(',')).join(' ')}" fill="none" stroke="url(#gold)" stroke-width="4.5" stroke-linejoin="round"/>
		<line x1="22" y1="100" x2="234" y2="100" stroke="url(#gold)" stroke-width="3"/>
		<line x1="78" y1="54" x2="178" y2="54" stroke="#fff" stroke-width="2" opacity=".8"/>
	</g>
	${glint(190, 46, 22)}${glint(70, 150, 10, 0.8)}`;
})();

// H3: Dice (ivory with rouge pips)
S.H3 = (() => {
	const die = (cx, cy, s, pipsTop, pipsL, pipsR) => {
		const k = 0.866;
		const A = [cx, cy - s], B = [cx + k * s, cy - s / 2], Cc = [cx, cy], D = [cx - k * s, cy - s / 2];
		const C2 = [cx, cy + s], D2 = [cx - k * s, cy + s / 2], B2 = [cx + k * s, cy + s / 2];
		const face = (pts, fill) => `<polygon points="${pts.map((pt) => pt.join(',')).join(' ')}" fill="${fill}" stroke="url(#gold)" stroke-width="2.5" stroke-linejoin="round"/>`;
		const mat = (O, P1, P2) => `matrix(${P1[0] - O[0]} ${P1[1] - O[1]} ${P2[0] - O[0]} ${P2[1] - O[1]} ${O[0]} ${O[1]})`;
		const pips = (list, O, P1, P2) =>
			`<g transform="${mat(O, P1, P2)}">${list.map(([u, v]) => `<circle cx="${u}" cy="${v}" r=".1" fill="#9E0F29"/><circle cx="${u - 0.025}" cy="${v - 0.025}" r=".035" fill="#FF8A9A" opacity=".6"/>`).join('')}</g>`;
		return `${face([A, B, Cc, D], '#FFFBF0')}${face([D, Cc, C2, D2], '#E9DCBE')}${face([Cc, B, B2, C2], '#C9B994')}
			${pips(pipsTop, D, A, Cc)}${pips(pipsL, D, Cc, D2)}${pips(pipsR, Cc, B, C2)}`;
	};
	const five = [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]];
	const three = [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]];
	const two = [[0.27, 0.27], [0.73, 0.73]];
	const one = [[0.5, 0.5]];
	const six = [[0.27, 0.22], [0.27, 0.5], [0.27, 0.78], [0.73, 0.22], [0.73, 0.5], [0.73, 0.78]];
	const four = [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]];
	return `<ellipse cx="128" cy="214" rx="96" ry="14" fill="url(#shadowBlob)"/><g filter="url(#ds)">${die(90, 102, 64, five, three, two)}${die(168, 150, 60, one, six, four)}</g>${glint(206, 66, 12, 0.9)}`;
})();

// H4: Fan of Aces
S.H4 = (() => {
	const card = (rot, s, col) => `<g transform="rotate(${rot} 128 232)">
		<rect x="82" y="40" width="92" height="132" rx="10" fill="url(#ivoryR)" stroke="url(#gold)" stroke-width="3"/>
		<rect x="88" y="46" width="80" height="120" rx="7" fill="none" stroke="#C99A45" stroke-opacity=".5" stroke-width="1"/>
		<text x="96" y="68" font-family="Limelight" font-size="20" fill="${col}">A</text>
		${suit(s, 99, 80, 12, col)}
		${suit(s, 128, 112, 40, col)}
	</g>`;
	const deco = [180, 270, 0, 90].map((r) => fan(128, 112, 26, r, 5, '#C99A45', 1.5)).join('');
	return `<g filter="url(#ds)" transform="translate(0 6)">${card(-30, 'club', '#16171A')}${card(-10, 'diamond', '#B3122E')}${card(10, 'heart', '#B3122E')}
	<g transform="rotate(30 128 232)">
		<rect x="82" y="40" width="92" height="132" rx="10" fill="url(#ivoryR)" stroke="url(#gold)" stroke-width="3"/>
		<rect x="88" y="46" width="80" height="120" rx="7" fill="none" stroke="#C99A45" stroke-width="1.5"/>
		<text x="96" y="68" font-family="Limelight" font-size="20" fill="#16171A">A</text>${suit('spade', 99, 80, 12, '#16171A')}
		${deco}
		${suit('spade', 128, 112, 44, '#16171A')}
	</g></g>`;
})();

// L1-L5: deco royals in jewel enamel. Heavier gold outline and a dark halo keep them legible on phones.
const letter = (txt, enamelId, suitName) => {
	const wide = txt.length > 1;
	const size = wide ? 150 : 186;
	const y = wide ? 182 : 190;
	const spacing = wide ? -10 : 0;
	const text = (extra) =>
		`<text x="128" y="${y}" text-anchor="middle" font-family="Limelight" font-size="${size}" letter-spacing="${spacing}" ${extra}>${txt}</text>`;
	return `
	<ellipse cx="128" cy="128" rx="96" ry="104" fill="url(#shadowBlob)" opacity=".7"/>
	<g filter="url(#ds)">
		${text('fill="none" stroke="#1A1206" stroke-width="16" stroke-linejoin="round"')}
		${text(`fill="url(#${enamelId})" stroke="url(#gold)" stroke-width="8" paint-order="stroke" stroke-linejoin="round"`)}
		${text('fill="#fff" opacity=".24" clip-path="url(#topHalf)"')}
		${suit(suitName, 128, 222, 32, 'url(#gold)')}
	</g>`;
};
S.L1 = letter('A', 'enEmerald', 'spade');
S.L2 = letter('K', 'enRouge', 'heart');
S.L3 = letter('Q', 'enSapphire', 'diamond');
S.L4 = letter('J', 'enAmethyst', 'club');
S.L5 = letter('10', 'enAmber', 'diamond');

// SCATTER: Golden Key on a lacquer medallion
S.S = `
	<circle cx="128" cy="128" r="126" fill="url(#glowRouge)"/>
	<g filter="url(#ds)">
		<circle cx="128" cy="118" r="98" fill="url(#lacquerR)" stroke="url(#goldD)" stroke-width="6"/>
		<circle cx="128" cy="118" r="88" fill="none" stroke="#B3122E" stroke-width="2.5" stroke-dasharray="2 7"/>
		<g transform="rotate(-38 128 118)">
			<rect x="104" y="110" width="106" height="17" rx="4" fill="url(#gold)"/>
			<rect x="177" y="124" width="12" height="30" fill="url(#gold)"/><rect x="196" y="124" width="12" height="21" fill="url(#gold)"/>
			<rect x="110" y="103" width="6" height="30" rx="2" fill="url(#gold)"/><rect x="120" y="105" width="5" height="26" rx="2" fill="url(#gold)"/>
			<circle cx="75" cy="118" r="35" fill="url(#goldD)"/>
			<circle cx="75" cy="118" r="25" fill="#2A0710"/>
			<path d="M75 95 L 92 118 L 75 141 L 58 118 Z" fill="url(#rougeR)" stroke="url(#gold)" stroke-width="2"/>
			${glint(69, 106, 6)}
		</g>
		<path d="M 52 68 A 82 82 0 0 1 150 30" stroke="#fff" stroke-opacity=".25" stroke-width="5" fill="none" stroke-linecap="round"/>
		<path d="${stepRect(56, 196, 144, 42, 8)}" fill="#120306" stroke="url(#gold)" stroke-width="3"/>
		<text x="128" y="226" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="25" letter-spacing="5" fill="url(#gold)">BONUS</text>
	</g>`;

export const SYMBOL_IDS = ['W', 'H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L5', 'S'];
export const symbolBody = (id) => S[id];

// Motion-blurred copy used while a reel is at full speed.
export const blurredSymbolBody = (id) => `<g filter="url(#motionV)" opacity=".92">${S[id]}</g>`;
