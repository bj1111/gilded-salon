// Pure particle physics for chip showers and glint bursts. Rendering lives in ParticleLayer.svelte;
// keeping the maths here makes it testable and keeps the frame loop allocation-free.

export type ParticleKind = 'chip' | 'glint';

export type Particle = {
	kind: ParticleKind;
	x: number;
	y: number;
	vx: number; // units per ms
	vy: number;
	rotation: number;
	spin: number; // radians per ms
	flip: number; // phase of the coin-flip (chips only)
	scale: number;
	alpha: number;
	age: number;
	life: number;
	gravity: number;
};

export type EmitOptions = {
	x: number;
	y: number;
	count: number;
	kind: ParticleKind;
	angle?: number; // direction (radians, 0 = right, -PI/2 = up)
	spread?: number; // full cone width in radians
	speed?: [number, number];
	gravity?: number; // units per ms^2
	life?: [number, number]; // ms
	scale?: [number, number];
};

const FADE_FROM = 0.7; // fade out over the last 30% of life

export const createParticleSim = (max: number, random: () => number = Math.random) => {
	const particles: Particle[] = [];
	const between = ([min, max]: [number, number]) => min + random() * (max - min);

	const emit = ({
		x,
		y,
		count,
		kind,
		angle = -Math.PI / 2,
		spread = Math.PI * 2,
		speed = [0.2, 0.6],
		gravity = 0.0012,
		life = [900, 1600],
		scale = [0.7, 1.1],
	}: EmitOptions) => {
		const room = Math.max(0, max - particles.length);
		for (let i = 0; i < Math.min(count, room); i++) {
			const direction = angle + (random() - 0.5) * spread;
			const velocity = between(speed);
			particles.push({
				kind,
				x,
				y,
				vx: Math.cos(direction) * velocity,
				vy: Math.sin(direction) * velocity,
				rotation: random() * Math.PI * 2,
				spin: (random() - 0.5) * 0.012,
				flip: random() * Math.PI * 2,
				scale: between(scale),
				alpha: 1,
				age: 0,
				life: between(life),
				gravity,
			});
		}
	};

	const step = (dt: number) => {
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.age += dt;
			if (p.age >= p.life) {
				particles.splice(i, 1);
				continue;
			}
			p.vy += p.gravity * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.rotation += p.spin * dt;
			p.flip += 0.012 * dt;
			const t = p.age / p.life;
			p.alpha = t < FADE_FROM ? 1 : Math.max(0, 1 - (t - FADE_FROM) / (1 - FADE_FROM));
		}
	};

	const clear = () => {
		particles.length = 0;
	};

	return { particles, emit, step, clear };
};
