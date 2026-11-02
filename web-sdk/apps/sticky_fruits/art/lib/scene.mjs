// The salon: backgrounds, curtains, reel frame, felt, logo crest, panels and banners.
import { fan, glint, stepRect, sunburst } from './defs.mjs';

// ---------------------------------------------------------------- salon backgrounds

// Arched window onto Monaco harbour at night. Returns markup plus harbour-light positions
// (used by the game to twinkle a few of them).
const harbourWindow = (x, y, w, h, { moon = false, seed = 1 } = {}) => {
	const ax = x + w / 2, r = w / 2;
	const id = `wc${Math.round(x)}_${Math.round(y)}`;
	const clip = `M${x} ${y + h} V${y + r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h} Z`;
	const horizon = y + h * 0.6;
	const lights = Array.from({ length: 12 }, (_, i) => {
		const k = (i * 7919 * seed) % 997;
		return [x + 14 + (k % (w - 28)), horizon + 4 + (k % 9), 1.6 + (i % 3) * 0.8, i % 4 ? '#F0D592' : '#F5ECD9'];
	});
	const stars = Array.from({ length: 22 }, (_, i) => {
		const k = (i * 104729 * seed) % 1009;
		return `<circle cx="${x + (k % w)}" cy="${y + 20 + ((k * 3) % (h * 0.42))}" r="${0.8 + (i % 2)}" fill="#fff" opacity="${0.25 + (i % 3) * 0.2}"/>`;
	}).join('');
	const markup = `
		<clipPath id="${id}"><path d="${clip}"/></clipPath>
		<g clip-path="url(#${id})">
			<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sky)"/>
			${moon ? `<circle cx="${ax + w * 0.14}" cy="${y + r * 0.95}" r="${w * 0.08}" fill="#F5ECD9" opacity=".92"/><circle cx="${ax + w * 0.14}" cy="${y + r * 0.95}" r="${w * 0.25}" fill="url(#glowGold)" opacity=".22"/>` : ''}
			${stars}
			<path d="M${x} ${horizon} L ${x + w * 0.18} ${horizon - h * 0.05} L ${x + w * 0.42} ${horizon - h * 0.02} L ${x + w * 0.66} ${horizon - h * 0.08} L ${x + w} ${horizon - h * 0.03} V ${horizon + 2} H ${x} Z" fill="#0A1124"/>
			<rect x="${x}" y="${horizon}" width="${w}" height="${h * 0.4}" fill="url(#sea)"/>
			${lights.map(([lx, ly, lr, c]) => `<circle cx="${lx}" cy="${ly}" r="${lr}" fill="${c}" opacity=".85"/><rect x="${lx - 0.8}" y="${ly + 4}" width="1.6" height="${20 + (lr * 9)}" fill="#F0D592" opacity=".16"/>`).join('')}
			${moon ? `<rect x="${ax + w * 0.14 - 10}" y="${horizon + 6}" width="20" height="${h * 0.3}" fill="#F5ECD9" opacity=".08"/>` : ''}
		</g>
		<path d="${clip}" fill="none" stroke="url(#gold)" stroke-width="5"/>
		<path d="${clip}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1" transform="translate(0 3)"/>
		<path d="M${ax} ${y} V${y + h} M${x} ${y + h * 0.55} H${x + w} M${ax} ${y + r} L ${x + 10} ${y + r * 0.55} M${ax} ${y + r} L ${x + w - 10} ${y + r * 0.55}" stroke="#C99A45" stroke-opacity=".6" stroke-width="2.5"/>
		<circle cx="${ax}" cy="${y + r}" r="12" fill="none" stroke="#C99A45" stroke-opacity=".7" stroke-width="2.5"/>
		<rect x="${x - 16}" y="${y + h}" width="${w + 32}" height="14" fill="url(#goldH)" opacity=".75"/>`;
	return { markup, lights: lights.map(([lx, ly]) => [Math.round(lx), Math.round(ly)]) };
};

const pilaster = (x, y, w, h) => `
	<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#121318"/>
	${Array.from({ length: 4 }, (_, i) => `<line x1="${x + (w * (i + 1)) / 5}" y1="${y + 16}" x2="${x + (w * (i + 1)) / 5}" y2="${y + h - 10}" stroke="#C99A45" stroke-opacity=".28" stroke-width="2"/>`).join('')}
	<path d="M ${x - 8} ${y} h ${w + 16} v 16 h -${w + 16} Z" fill="url(#goldH)" opacity=".75"/>
	<path d="M ${x - 4} ${y + 16} h ${w + 8} v 6 h -${w + 8} Z" fill="#8C6A2E" opacity=".6"/>`;

// Tall deco wall panel with stepped top and inlaid gold lines
const wallPanel = (x, y, w, h) => `
	<path d="M ${x} ${y + h} V ${y + 40} H ${x + w * 0.2} V ${y + 20} H ${x + w * 0.35} V ${y} H ${x + w * 0.65} V ${y + 20} H ${x + w * 0.8} V ${y + 40} H ${x + w} V ${y + h} Z" fill="#111216" stroke="#C99A45" stroke-opacity=".32" stroke-width="2"/>
	<path d="M ${x + 14} ${y + h - 14} V ${y + 54} H ${x + w * 0.2 + 10} V ${y + 34} H ${x + w * 0.35 + 10} V ${y + 14} H ${x + w * 0.65 - 10} V ${y + 34} H ${x + w * 0.8 - 10} V ${y + 54} H ${x + w - 14} V ${y + h - 14} Z" fill="none" stroke="#C99A45" stroke-opacity=".18" stroke-width="1.5"/>`;

// Chandelier: tiers of crystal drops under a gold canopy
const chandelier = (cx, top, s = 1) => {
	const drops = [];
	const tiers = [
		[150, 70, 13],
		[110, 112, 10],
		[66, 148, 7],
	];
	for (const [rx, y, n] of tiers) {
		for (let i = 0; i < n; i++) {
			const t = n === 1 ? 0.5 : i / (n - 1);
			const x = cx + (t - 0.5) * 2 * rx * s;
			const dy = top + (y + Math.sin(t * Math.PI) * 18) * s;
			drops.push([x, dy]);
		}
	}
	const arcs = tiers
		.map(([rx, y]) => `<path d="M ${cx - rx * s} ${top + y * s} Q ${cx} ${top + (y + 36) * s} ${cx + rx * s} ${top + y * s}" fill="none" stroke="url(#gold)" stroke-width="${2.5 * s}" opacity=".85"/>`)
		.join('');
	const markup = `
		<ellipse cx="${cx}" cy="${top + 90 * s}" rx="${330 * s}" ry="${190 * s}" fill="url(#glowWarm)"/>
		<line x1="${cx}" y1="${top - 200}" x2="${cx}" y2="${top + 40 * s}" stroke="url(#gold)" stroke-width="${3 * s}"/>
		<path d="M ${cx - 40 * s} ${top + 40 * s} H ${cx + 40 * s} L ${cx + 22 * s} ${top + 58 * s} H ${cx - 22 * s} Z" fill="url(#goldD)"/>
		${arcs}
		${drops.map(([x, y]) => `<line x1="${x}" y1="${y - 10 * s}" x2="${x}" y2="${y}" stroke="#C99A45" stroke-width="${1 * s}" opacity=".7"/><path d="M ${x} ${y} l ${3 * s} ${7 * s} l -${3 * s} ${9 * s} l -${3 * s} -${9 * s} Z" fill="#FFF4CF" opacity=".85"/>`).join('')}
		<path d="M ${cx - 6 * s} ${top + 150 * s} l ${6 * s} ${26 * s} l ${6 * s} -${26 * s} Z" fill="url(#gold)"/>`;
	return { markup, glints: drops.filter((_, i) => i % 3 === 0).map(([x, y]) => [Math.round(x), Math.round(y + 8 * s)]) };
};

export const salonLandscape = () => {
	const W = 1920, H = 1080;
	const left = harbourWindow(86, 150, 330, 700, { moon: true, seed: 1 });
	const right = harbourWindow(W - 86 - 330, 150, 330, 700, { seed: 3 });
	const chand = chandelier(W / 2, 0, 1.15);
	const body = `
	<rect width="${W}" height="${H}" fill="url(#wall)"/>
	${wallPanel(500, 120, 280, 760)}${wallPanel(W - 500 - 280, 120, 280, 760)}${wallPanel(800, 220, 320, 660)}
	${pilaster(452, 90, 40, 800)}${pilaster(W - 452 - 40, 90, 40, 800)}
	<g opacity=".16">${sunburst(W / 2, 560, 520, 37, 3)}</g>
	${left.markup}${right.markup}
	${chand.markup}
	<rect x="0" y="880" width="${W}" height="${H - 880}" fill="#08090B"/>
	<rect x="0" y="880" width="${W}" height="4" fill="url(#goldH)" opacity=".7"/>
	${Array.from({ length: 24 }, (_, i) => `<rect x="${i * 80 + 30}" y="900" width="44" height="150" fill="none" stroke="#C99A45" stroke-opacity=".12" stroke-width="2"/>`).join('')}
	<rect width="${W}" height="${H}" fill="url(#vign)"/>
	<rect width="${W}" height="${H}" filter="url(#grain)"/>`;
	return { w: W, h: H, body, lights: [...left.lights, ...right.lights], glints: chand.glints };
};

export const salonPortrait = () => {
	const W = 1080, H = 1920;
	const left = harbourWindow(70, 170, 250, 560, { moon: true, seed: 5 });
	const right = harbourWindow(W - 70 - 250, 170, 250, 560, { seed: 7 });
	const chand = chandelier(W / 2, 0, 1.0);
	const body = `
	<rect width="${W}" height="${H}" fill="url(#wall)"/>
	${wallPanel(380, 260, 320, 520)}
	${pilaster(340, 120, 28, 700)}${pilaster(W - 340 - 28, 120, 28, 700)}
	<g opacity=".16">${sunburst(W / 2, 1050, 520, 31, 3)}</g>
	${left.markup}${right.markup}
	${chand.markup}
	${wallPanel(70, 900, 260, 640)}${wallPanel(W - 70 - 260, 900, 260, 640)}${wallPanel(380, 900, 320, 640)}
	<rect x="0" y="1560" width="${W}" height="${H - 1560}" fill="#08090B"/>
	<rect x="0" y="1560" width="${W}" height="4" fill="url(#goldH)" opacity=".7"/>
	<rect width="${W}" height="${H}" fill="url(#vign)"/>
	<rect width="${W}" height="${H}" filter="url(#grain)"/>`;
	return { w: W, h: H, body, lights: [...left.lights, ...right.lights], glints: chand.glints };
};

// The private room: same salon, lights down, one warm spotlight on the table.
export const privateRoom = (base) => {
	const { w: W, h: H } = base;
	const body = `
	${base.body}
	<rect width="${W}" height="${H}" fill="#050407" opacity=".62"/>
	<path d="M ${W * 0.36} 0 L ${W * 0.64} 0 L ${W * 0.84} ${H} L ${W * 0.16} ${H} Z" fill="#F0D592" opacity=".06"/>
	<ellipse cx="${W / 2}" cy="${H * 0.55}" rx="${W * 0.42}" ry="${H * 0.36}" fill="url(#glowWarm)" opacity=".55"/>
	<rect width="${W}" height="${H}" fill="url(#vign)"/>`;
	return { w: W, h: H, body };
};

// Velvet drape that slides in over a window during free spins (left one; right is mirrored).
export const curtain = (w = 560, h = 1080) => {
	const folds = 7;
	const edge = Array.from({ length: 13 }, (_, i) => {
		const y = (i / 12) * h;
		const x = w - 40 - Math.sin((i / 12) * Math.PI) * 120 + (i % 2 ? 14 : -10);
		return `${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(' L ');
	const body = `
	<path d="M 0 0 L ${edge} L 0 ${h} Z" fill="url(#velvet)"/>
	${Array.from({ length: folds }, (_, i) => `<path d="M ${(i + 0.5) * (w / folds) * 0.8} 0 C ${(i + 0.5) * (w / folds) * 0.8 + 18} ${h * 0.4}, ${(i + 0.5) * (w / folds) * 0.7 - 10} ${h * 0.7}, ${(i + 0.5) * (w / folds) * 0.6} ${h}" stroke="#000" stroke-opacity=".22" stroke-width="10" fill="none"/>`).join('')}
	<path d="M 0 0 L ${edge} L 0 ${h} Z" fill="url(#velvetShade)"/>
	<path d="M ${w - 160} ${h * 0.58} q 40 -26 110 -8" stroke="url(#gold)" stroke-width="10" fill="none" stroke-linecap="round"/>
	<circle cx="${w - 50}" cy="${h * 0.565}" r="16" fill="url(#goldD)"/>
	<path d="M ${w - 58} ${h * 0.58} l -10 70 h 34 l -8 -70 Z" fill="url(#gold)"/>`;
	return { w, h, body };
};

export const valance = (w = 1920, h = 120) => ({
	w,
	h,
	body: `
	<path d="M 0 0 H ${w} V ${h - 40} ${Array.from({ length: 24 }, (_, i) => `Q ${w - (i + 0.5) * (w / 24)} ${h} ${w - (i + 1) * (w / 24)} ${h - 40}`).join(' ')} Z" fill="url(#velvet)"/>
	<path d="M 0 0 H ${w} V ${h - 40} ${Array.from({ length: 24 }, (_, i) => `Q ${w - (i + 0.5) * (w / 24)} ${h} ${w - (i + 1) * (w / 24)} ${h - 40}`).join(' ')} Z" fill="url(#velvetShade)"/>
	<rect x="0" y="${h - 48}" width="${w}" height="5" fill="url(#goldH)"/>
	${Array.from({ length: 96 }, (_, i) => `<line x1="${i * (w / 96) + 6}" y1="${h - 43}" x2="${i * (w / 96) + 6}" y2="${h - 30 + (i % 2) * 4}" stroke="#C99A45" stroke-width="2"/>`).join('')}`,
});

// ---------------------------------------------------------------- reel frame (game units: board 600 x 360)

export const BOARD = { w: 600, h: 360, cell: 120 };
export const FRAME_PAD = 26;
const FRAME_MARGIN = 36;

export const frame = () => {
	const pad = FRAME_PAD, m = FRAME_MARGIN;
	const W = BOARD.w + (pad + m) * 2, H = BOARD.h + (pad + m) * 2;
	const fx = m, fy = m, fw = BOARD.w + pad * 2, fh = BOARD.h + pad * 2;
	const bx = m + pad, by = m + pad;
	const hole = `M${bx} ${by} H${bx + BOARD.w} V${by + BOARD.h} H${bx} Z`;
	const ring = (x, y, w, h, n) => `${stepRect(x, y, w, h, n)} ${hole}`;
	const flutes = (x, y, h) => Array.from({ length: 3 }, (_, i) => `<line x1="${x + i * 5}" y1="${y}" x2="${x + i * 5}" y2="${y + h}" stroke="#6B4F1F" stroke-width="1.5" opacity=".7"/>`).join('');
	const body = `
	<path d="${ring(fx - 10, fy - 4, fw + 20, fh + 22, 22)}" fill="#000" opacity=".55" filter="url(#blur8)" fill-rule="evenodd"/>
	<path d="${ring(fx, fy, fw, fh, 18)}" fill="url(#goldD)" fill-rule="evenodd"/>
	<path d="${ring(fx + 6, fy + 6, fw - 12, fh - 12, 14)}" fill="#0B0C0E" fill-rule="evenodd"/>
	<path d="${stepRect(fx + 10, fy + 10, fw - 20, fh - 20, 11)}" fill="none" stroke="url(#gold)" stroke-width="2"/>
	${flutes(fx + 12, fy + 44, fh - 88)}${flutes(fx + fw - 22, fy + 44, fh - 88)}
	<rect x="${bx}" y="${by}" width="${BOARD.w}" height="${BOARD.h}" fill="none" stroke="url(#gold)" stroke-width="2.5"/>
	${fan(fx + 4, fy + 4, 26, 0, 6, 'url(#gold)', 1.5)}${fan(fx + fw - 4, fy + 4, 26, 90, 6, 'url(#gold)', 1.5)}
	${fan(fx + fw - 4, fy + fh - 4, 26, 180, 6, 'url(#gold)', 1.5)}${fan(fx + 4, fy + fh - 4, 26, 270, 6, 'url(#gold)', 1.5)}
	<path d="M ${fx + 30} ${fy + 3} H ${fx + fw - 30}" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>`;
	return { w: W, h: H, body, geometry: { w: W, h: H, boardX: bx, boardY: by, pad, margin: m } };
};

export const felt = () => ({
	w: BOARD.w,
	h: BOARD.h,
	body: `
	<rect width="${BOARD.w}" height="${BOARD.h}" fill="url(#felt)"/>
	<rect width="${BOARD.w}" height="${BOARD.h}" filter="url(#baize)" opacity=".55"/>
	${Array.from({ length: 4 }, (_, i) => `<line x1="${BOARD.cell * (i + 1)}" y1="8" x2="${BOARD.cell * (i + 1)}" y2="${BOARD.h - 8}" stroke="#C99A45" stroke-opacity=".3" stroke-width="1.5"/>`).join('')}
	<rect width="${BOARD.w}" height="${BOARD.h}" fill="url(#innerVign)"/>`,
});

// darkens the top and bottom edge of the reels so they read as drums
export const reelShade = () => ({
	w: BOARD.w,
	h: BOARD.h,
	body: `<rect width="${BOARD.w}" height="${BOARD.h}" fill="url(#shadeV)"/>`,
});

// ---------------------------------------------------------------- logo crest

const LOGO = { w: 540, h: 236, cx: 270, cy: 200, pw: 480, ph: 78 };

export const logo = ({ title = true } = {}) => {
	const { w, h, cx, cy, pw, ph } = LOGO;
	const top = cy - ph * 0.72;
	const body = `
	<clipPath id="crestClip"><rect x="0" y="0" width="${w}" height="${cy}"/></clipPath>
	<g clip-path="url(#crestClip)">${sunburst(cx, cy, 160, 19, 3)}
		<path d="M ${cx - 160} ${cy} A 160 160 0 0 1 ${cx + 160} ${cy}" fill="none" stroke="url(#gold)" stroke-width="3"/>
		<path d="M ${cx - 118} ${cy} A 118 118 0 0 1 ${cx + 118} ${cy}" fill="none" stroke="url(#gold)" stroke-width="1.5"/></g>
	<g filter="url(#ds)">
		<path d="${stepRect(cx - pw / 2, top, pw, ph, 14)}" fill="#0B0C0E" stroke="url(#goldD)" stroke-width="4"/>
		<path d="${stepRect(cx - pw / 2 + 7, top + 7, pw - 14, ph - 14, 10)}" fill="none" stroke="#C99A45" stroke-opacity=".55" stroke-width="1.5"/>
		${title ? `<text x="${cx}" y="${top + ph * 0.67}" text-anchor="middle" font-family="Limelight" font-size="46" letter-spacing="6" fill="url(#gold)">GILDED SALON</text>` : ''}
	</g>`;
	return { w, h, body };
};

export const LOGO_GEOMETRY = { w: LOGO.w, h: LOGO.h, anchorY: LOGO.cy / LOGO.h, plaqueH: LOGO.ph };

// ---------------------------------------------------------------- panels, plaques, banners, rail

export const panel = (w = 640, h = 420) => ({
	w,
	h,
	body: `
	<path d="${stepRect(6, 10, w - 12, h - 12, 26)}" fill="#000" opacity=".55" filter="url(#blur8)"/>
	<path d="${stepRect(4, 4, w - 8, h - 12, 24)}" fill="url(#lacquerR)" stroke="url(#goldD)" stroke-width="5"/>
	<path d="${stepRect(18, 18, w - 36, h - 40, 16)}" fill="none" stroke="#C99A45" stroke-opacity=".6" stroke-width="1.5"/>
	${fan(18, 18, 46, 0, 7)}${fan(w - 18, 18, 46, 90, 7)}${fan(w - 18, h - 22, 46, 180, 7)}${fan(18, h - 22, 46, 270, 7)}
	<g opacity=".5">${sunburst(w / 2, 26, 60, 13, 2)}</g>`,
});

export const plaque = (w = 320, h = 80) => ({
	w,
	h,
	body: `
	<path d="${stepRect(4, 6, w - 8, h - 8, 12)}" fill="#000" opacity=".5" filter="url(#blur3)"/>
	<path d="${stepRect(3, 3, w - 6, h - 9, 12)}" fill="#0B0C0E" stroke="url(#goldD)" stroke-width="3"/>
	<path d="${stepRect(9, 9, w - 18, h - 21, 8)}" fill="none" stroke="#C99A45" stroke-opacity=".45" stroke-width="1.2"/>`,
});

export const banner = (text) => {
	const w = 1100, h = 220;
	return {
		w,
		h,
		body: `
		<text x="${w / 2}" y="150" text-anchor="middle" font-family="Limelight" font-size="140" letter-spacing="10" fill="#000" opacity=".6" filter="url(#blur8)">${text}</text>
		<text x="${w / 2}" y="146" text-anchor="middle" font-family="Limelight" font-size="140" letter-spacing="10" fill="url(#gold)" stroke="#3B2A0C" stroke-width="3" paint-order="stroke">${text}</text>
		<text x="${w / 2}" y="146" text-anchor="middle" font-family="Limelight" font-size="140" letter-spacing="10" fill="#fff" opacity=".2" clip-path="url(#bannerTop)">${text}</text>
		<clipPath id="bannerTop"><rect x="0" y="0" width="${w}" height="98"/></clipPath>
		<path d="M ${w / 2 - 300} 182 H ${w / 2 + 300}" stroke="url(#goldH)" stroke-width="4"/>
		${glint(w / 2 + 300, 182, 12)}${glint(w / 2 - 300, 182, 12)}`,
	};
};

export const rail = () => ({
	w: 16,
	h: 240,
	body: `<rect width="16" height="240" fill="url(#rail)"/><rect width="16" height="3" fill="#E6C77F"/><rect y="7" width="16" height="1" fill="#C99A45" opacity=".5"/>`,
});

// Croupier's rake, used to sweep the locked chips off the felt at the end of free spins
export const rake = () => ({
	w: 720,
	h: 90,
	body: `
	<g filter="url(#dsS)">
		<rect x="0" y="40" width="560" height="10" rx="5" fill="#2A1A0C" stroke="url(#gold)" stroke-width="1.5"/>
		<rect x="40" y="38" width="12" height="14" rx="2" fill="url(#gold)"/><rect x="520" y="38" width="12" height="14" rx="2" fill="url(#gold)"/>
		<path d="M 560 45 L 600 45 L 612 10 L 626 10 L 626 80 L 612 80 L 600 45" fill="url(#goldD)"/>
		<rect x="620" y="8" width="18" height="74" rx="3" fill="#1A1206" stroke="url(#gold)" stroke-width="2"/>
	</g>`,
});
