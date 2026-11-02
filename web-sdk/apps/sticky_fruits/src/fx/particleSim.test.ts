import { describe, expect, it } from 'vitest';

import { createParticleSim } from './particleSim';

const fixed = () => 0.5; // deterministic "random"

describe('particle simulation', () => {
	it('emits the requested particles at the origin', () => {
		const sim = createParticleSim(50, fixed);
		sim.emit({ x: 10, y: 20, count: 5, kind: 'chip' });
		expect(sim.particles).toHaveLength(5);
		expect(sim.particles.every((p) => p.x === 10 && p.y === 20)).toBe(true);
	});

	it('never holds more than its maximum', () => {
		const sim = createParticleSim(8, fixed);
		sim.emit({ x: 0, y: 0, count: 5, kind: 'chip' });
		sim.emit({ x: 0, y: 0, count: 5, kind: 'glint' });
		expect(sim.particles.length).toBe(8);
	});

	it('moves particles by velocity and pulls them down with gravity', () => {
		const sim = createParticleSim(5, fixed);
		sim.emit({ x: 0, y: 0, count: 1, kind: 'chip', angle: 0, spread: 0, speed: [1, 1], gravity: 0.002, life: [5000, 5000] });
		sim.step(100);
		const p = sim.particles[0];
		expect(p.x).toBeCloseTo(100, 5);
		expect(p.vy).toBeCloseTo(0.2, 5);
		expect(p.y).toBeGreaterThan(0);
	});

	it('fades out at the end of life and then frees the slot', () => {
		const sim = createParticleSim(5, fixed);
		sim.emit({ x: 0, y: 0, count: 2, kind: 'glint', life: [1000, 1000] });
		sim.step(900);
		expect(sim.particles[0].alpha).toBeLessThan(1);
		expect(sim.particles[0].alpha).toBeGreaterThan(0);
		sim.step(200);
		expect(sim.particles).toHaveLength(0);
	});

	it('clears everything at once', () => {
		const sim = createParticleSim(5, fixed);
		sim.emit({ x: 0, y: 0, count: 3, kind: 'chip' });
		sim.clear();
		expect(sim.particles).toHaveLength(0);
	});
});
