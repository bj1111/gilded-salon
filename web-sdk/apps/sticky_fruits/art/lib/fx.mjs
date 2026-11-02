// Effect textures: glows, glints, rings, rays, beams, chips, spotlight and light sweep.
import { glint } from './defs.mjs';

export const fx = {
	fx_glow: { w: 256, h: 256, body: `<circle cx="128" cy="128" r="128" fill="url(#glowGold)"/>` },
	fx_rouge: { w: 256, h: 256, body: `<circle cx="128" cy="128" r="128" fill="url(#glowRouge)"/>` },
	fx_glint: { w: 64, h: 64, body: `<circle cx="32" cy="32" r="20" fill="url(#glowGold)" opacity=".6"/>${glint(32, 32, 28)}` },
	fx_ring: {
		w: 256,
		h: 256,
		body: `<circle cx="128" cy="128" r="112" fill="none" stroke="#F0D592" stroke-width="10" opacity=".35" filter="url(#blur8)"/><circle cx="128" cy="128" r="112" fill="none" stroke="url(#gold)" stroke-width="4"/>`,
	},
	// one ray of a takeover sunburst; anchor at bottom centre and rotate
	fx_ray: {
		w: 64,
		h: 1024,
		body: `<defs><linearGradient id="rayG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F0D592" stop-opacity=".9"/><stop offset="1" stop-color="#F0D592" stop-opacity="0"/></linearGradient></defs><path d="M 30 1024 L 0 0 H 64 L 34 1024 Z" fill="url(#rayG)"/>`,
	},
	// soft horizontal beam segment for payline traces (stretched along each segment)
	fx_beam: {
		w: 64,
		h: 32,
		body: `<defs><linearGradient id="beamG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A8" stop-opacity="0"/><stop offset=".5" stop-color="#FFF4CF" stop-opacity="1"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></linearGradient></defs><rect width="64" height="32" fill="url(#beamG)"/>`,
	},
	fx_dot: {
		w: 64,
		h: 64,
		body: `<circle cx="32" cy="32" r="30" fill="url(#glowGold)"/><circle cx="32" cy="32" r="9" fill="#FFF4CF"/>`,
	},
	// small chip for showers and bursts
	fx_chip: {
		w: 96,
		h: 96,
		body: `<g filter="url(#dsS)"><circle cx="48" cy="48" r="42" fill="url(#goldD)"/>
			${Array.from({ length: 8 }, (_, i) => `<g transform="rotate(${i * 45 + 22.5} 48 48)"><rect x="43" y="7" width="10" height="11" rx="1.5" fill="#121317"/></g>`).join('')}
			<circle cx="48" cy="48" r="27" fill="url(#lacquerR)" stroke="url(#gold)" stroke-width="2.5"/>
			<circle cx="48" cy="48" r="9" fill="url(#gold)" opacity=".85"/></g>`,
	},
	fx_spot: {
		w: 512,
		h: 1024,
		body: `<defs><linearGradient id="spotG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF1C8" stop-opacity=".5"/><stop offset="1" stop-color="#FFF1C8" stop-opacity="0"/></linearGradient></defs><path d="M 200 0 H 312 L 512 1024 H 0 Z" fill="url(#spotG)" filter="url(#blur20)"/>`,
	},
	fx_sweep: {
		w: 512,
		h: 160,
		body: `<defs><linearGradient id="sweepG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#FFF8E0" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="M 200 0 H 320 L 260 160 H 140 Z" fill="url(#sweepG)" filter="url(#blur3)"/>`,
	},
	fx_divider: {
		w: 24,
		h: 360,
		body: `<defs><linearGradient id="divG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A8" stop-opacity="0"/><stop offset=".5" stop-color="#FFF4CF" stop-opacity="1"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></linearGradient></defs><rect x="9" width="6" height="360" fill="url(#divG)" filter="url(#blur3)"/><rect x="11" width="2" height="360" fill="url(#divG)"/>`,
	},
};
