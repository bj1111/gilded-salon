// The casino floor behind the reels, shot "through a lens": rows of slot cabinets and lit tables
// recede to a vanishing point under a ceiling of lamps, everything thrown out of focus, with
// bokeh discs in front. Only the reels are sharp, so the board reads as the machine in focus.

// small seeded PRNG so every render of the art is identical
const rng = (seed) => () => {
	seed = (seed * 1664525 + 1013904223) % 4294967296;
	return seed / 4294967296;
};

const CABINET = ['#FF3B5C', '#FFB02E', '#3FA9FF', '#B35CFF', '#2EE6A6', '#FFD86B', '#FF6A2E'];
const BOKEH = ['#FFD27A', '#FFB347', '#FFD27A', '#FFE9C2', '#FF7A5A', '#FFC94D'];

const defs = (W, H, vpY) => `
	<linearGradient id="room" x1="0" y1="0" x2="0" y2="1">
		<stop offset="0" stop-color="#0E0806"/>
		<stop offset="${((vpY - 120) / H).toFixed(3)}" stop-color="#2A140B"/>
		<stop offset="${(vpY / H).toFixed(3)}" stop-color="#3A1B0C"/>
		<stop offset="${((vpY + 140) / H).toFixed(3)}" stop-color="#2A0C0E"/>
		<stop offset="1" stop-color="#0C0405"/>
	</linearGradient>
	<radialGradient id="haze" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFB766" stop-opacity=".55"/><stop offset=".5" stop-color="#C8642A" stop-opacity=".16"/><stop offset="1" stop-color="#C8642A" stop-opacity="0"/></radialGradient>
	<radialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFF1CF" stop-opacity="1"/><stop offset=".25" stop-color="#FFD38A" stop-opacity=".55"/><stop offset="1" stop-color="#FF9A3C" stop-opacity="0"/></radialGradient>
	${CABINET.map((c, i) => `<radialGradient id="cab${i}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${c}" stop-opacity=".75"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')}
	${CABINET.map((c, i) => `<linearGradient id="refl${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".3"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`).join('')}
	<pattern id="carpetDots" width="${Math.round(W / 40)}" height="${Math.round(W / 64)}" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.2" fill="#E0A84A" opacity=".35"/></pattern>
	${BOKEH.map((c, i) => `<radialGradient id="bk${i}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${c}" stop-opacity=".34"/><stop offset=".8" stop-color="${c}" stop-opacity=".38"/><stop offset=".94" stop-color="${c}" stop-opacity=".5"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')}
	<filter id="dof" filterUnits="userSpaceOnUse" x="-200" y="-200" width="${W + 400}" height="${H + 400}"><feGaussianBlur stdDeviation="${Math.round(W / 220)}"/></filter>
	<filter id="dofFar" filterUnits="userSpaceOnUse" x="-200" y="-200" width="${W + 400}" height="${H + 400}"><feGaussianBlur stdDeviation="${Math.round(W / 150)}"/></filter>
	<filter id="bloom" filterUnits="userSpaceOnUse" x="-200" y="-200" width="${W + 400}" height="${H + 400}"><feGaussianBlur stdDeviation="${Math.round(W / 60)}"/></filter>
	<filter id="bokehSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
	<filter id="photoGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 .9  0 0 0 0 .8  0 0 0 .07 0"/></filter>`;

export const casinoFloor = ({ W, H, vpY, seed = 7, scale = 1, ceil = -430 }) => {
	const r = rng(seed);
	const vpX = W / 2;
	// depth z >= 1: screen position of a world point (x across, y below the eye line)
	const px = (x, z) => vpX + (x * scale) / z;
	const py = (y, z) => vpY + (y * scale) / z;
	const depths = [1.15, 1.5, 1.95, 2.5, 3.2, 4.1, 5.3, 6.8, 8.8, 11.5];

	// ceiling: rows of recessed lamps and a few chandeliers, far rows first
	const ceiling = [];
	const chandeliers = [];
	for (const z of [...depths].reverse()) {
		for (let x = -2600; x <= 2600; x += 260) {
			const cx = px(x + (z * 37) % 130, z), cy = py(ceil, z), s = (34 * scale) / z;
			ceiling.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(s * 2.6).toFixed(1)}" ry="${(s * 1.5).toFixed(1)}" fill="url(#lampGlow)" opacity="${Math.min(1, 0.45 + 1.4 / z).toFixed(2)}"/>`);
		}
		if (z < 7) {
			for (const x of [-900, 900]) {
				const cx = px(x, z), cy = py(ceil * 0.7, z), s = (150 * scale) / z;
				chandeliers.push([cx, cy, s]);
			}
		}
	}
	const chandelierMarkup = chandeliers
		.map(([cx, cy, s]) => {
			const drops = Array.from({ length: 16 }, (_, i) => {
				const a = (i / 16) * Math.PI * 2;
				return `<circle cx="${(cx + Math.cos(a) * s * 0.55).toFixed(1)}" cy="${(cy + Math.sin(a) * s * 0.18 + s * 0.1).toFixed(1)}" r="${(s * 0.05).toFixed(1)}" fill="#FFF6DD"/>`;
			}).join('');
			return `<ellipse cx="${cx}" cy="${cy}" rx="${s * 1.5}" ry="${s * 0.9}" fill="url(#lampGlow)"/>${drops}`;
		})
		.join('');

	// slot banks along both aisles and tables in the middle distance, far to near
	const floorItems = [];
	const lights = [];
	for (const z of [...depths].reverse()) {
		for (const side of [-1, 1]) {
			for (const lane of [650, 1050, 1450, 1850]) {
				const x = side * (lane + (z * 53) % 60);
				const w = (118 * scale) / z, h = (300 * scale) / z;
				const cx = px(x, z), base = py(300, z), top = base - h;
				const c = Math.floor(r() * CABINET.length);
				floorItems.push(`
					<rect x="${(cx - w / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(w * 0.08).toFixed(1)}" fill="#120A0A"/>
					<ellipse cx="${cx.toFixed(1)}" cy="${(top + h * 0.36).toFixed(1)}" rx="${(w * 1.1).toFixed(1)}" ry="${(h * 0.42).toFixed(1)}" fill="url(#cab${c})"/>
					<rect x="${(cx - w * 0.38).toFixed(1)}" y="${(top + h * 0.2).toFixed(1)}" width="${(w * 0.76).toFixed(1)}" height="${(h * 0.3).toFixed(1)}" fill="${CABINET[c]}" opacity=".85"/>
					<rect x="${(cx - w * 0.44).toFixed(1)}" y="${(top - h * 0.12).toFixed(1)}" width="${(w * 0.88).toFixed(1)}" height="${(h * 0.14).toFixed(1)}" rx="${(w * 0.2).toFixed(1)}" fill="${CABINET[(c + 2) % CABINET.length]}"/>
					<rect x="${(cx - w * 0.3).toFixed(1)}" y="${(top + h * 0.6).toFixed(1)}" width="${(w * 0.6).toFixed(1)}" height="${(h * 0.05).toFixed(1)}" fill="#FFE2A0" opacity=".7"/>
					<rect x="${(cx - w * 0.4).toFixed(1)}" y="${(base + 4).toFixed(1)}" width="${(w * 0.8).toFixed(1)}" height="${(h * 0.7).toFixed(1)}" fill="url(#refl${c})"/>`);
				if (z < 2.6 && Math.abs(cx - vpX) > W * 0.27) lights.push([Math.round(cx), Math.round(top - h * 0.05)]);
			}
		}
		// a gaming table with its lamp in the centre aisle
		if ([2.5, 4.1, 6.8].includes(z)) {
			for (const x of [-300, 300]) {
				const cx = px(x, z), cy = py(240, z), rx = (170 * scale) / z, ry = (52 * scale) / z;
				floorItems.push(`
					<ellipse cx="${cx}" cy="${cy}" rx="${rx * 1.6}" ry="${ry * 2.2}" fill="url(#haze)" opacity=".7"/>
					<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#4A1A0C"/>
					<ellipse cx="${cx}" cy="${cy - ry * 0.12}" rx="${rx * 0.88}" ry="${ry * 0.74}" fill="#1E7A5A"/>
					<ellipse cx="${cx}" cy="${cy - ry * 0.3}" rx="${rx * 0.5}" ry="${ry * 0.4}" fill="#FFE2A0" opacity=".25"/>
					<ellipse cx="${cx}" cy="${py(-120, z)}" rx="${rx * 0.35}" ry="${ry * 0.3}" fill="url(#lampGlow)"/>`);
			}
		}
	}


	// bokeh: out-of-focus lights between the lens and the reels
	const bokeh = Array.from({ length: Math.round(34 * (W * H) / (1920 * 1080)) }, () => {
		// mostly in the upper half, where the lamps are
		const x = r() * W, y = r() ** 1.6 * H * 0.85;
		const rad = (14 + r() ** 2.5 * 52) * scale;
		return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="url(#bk${Math.floor(r() * BOKEH.length)})" opacity="${(0.35 + r() * 0.4).toFixed(2)}"/>`;
	}).join('');

	const body = `
	<defs>${defs(W, H, vpY)}</defs>
	<rect width="${W}" height="${H}" fill="url(#room)"/>
	<g filter="url(#dofFar)">
		<ellipse cx="${vpX}" cy="${vpY}" rx="${W * 0.55}" ry="${H * 0.28}" fill="url(#haze)"/>
		${ceiling.join('')}
		${chandelierMarkup}
	</g>
	<rect x="0" y="${vpY}" width="${W}" height="${H - vpY}" fill="url(#carpetDots)" filter="url(#dof)" opacity=".5"/>
	<g filter="url(#dof)">
		${floorItems.join('')}
	</g>
	<g filter="url(#bloom)" style="mix-blend-mode:screen" opacity=".55">
		${ceiling.join('')}
		${chandelierMarkup}
	</g>
	<g filter="url(#bokehSoft)" style="mix-blend-mode:screen">${bokeh}</g>
	<rect width="${W}" height="${H}" fill="url(#vign)"/>
	<rect width="${W}" height="${H}" filter="url(#photoGrain)"/>`;

	const glints = chandeliers.filter(([, , s]) => s > 40 * scale).map(([cx, cy]) => [Math.round(cx), Math.round(cy)]);
	return { w: W, h: H, body, lights, glints };
};

export const casinoLandscape = () => casinoFloor({ W: 1920, H: 1080, vpY: 520, seed: 7, scale: 1 });
export const casinoPortrait = () => casinoFloor({ W: 1080, H: 1920, vpY: 1150, seed: 11, scale: 0.9, ceil: -1250 });
