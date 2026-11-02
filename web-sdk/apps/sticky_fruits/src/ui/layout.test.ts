import { describe, expect, it } from 'vitest';

import { computeLayout, frameRect, type Canvas, type Layout, type LayoutType, type Slot } from './layout';

// Mirrors utils-layout createLayout().layoutType so each size is tested with the type the SDK picks.
const sdkLayoutType = ({ width, height }: Canvas): LayoutType => {
	const ratio = width / height;
	if (ratio > 0.8 && ratio < 1.3) return 'tablet';
	if (ratio <= 0.8) return 'portrait';
	if (Math.min(width, height) <= 480) return 'landscape';
	return 'desktop';
};

// Stake Engine checks 1024x576, popouts 400x225 / 800x450 and mobile 425x812; plus common devices.
const SIZES: Canvas[] = [
	{ width: 1920, height: 1080 },
	{ width: 1366, height: 768 },
	{ width: 1024, height: 576 },
	{ width: 2560, height: 1080 },
	{ width: 800, height: 450 },
	{ width: 400, height: 225 },
	{ width: 844, height: 390 },
	{ width: 425, height: 812 },
	{ width: 390, height: 844 },
	{ width: 360, height: 780 },
	{ width: 768, height: 1024 },
	{ width: 1024, height: 1024 },
];

const PHONES: Canvas[] = [
	{ width: 425, height: 812 },
	{ width: 390, height: 844 },
	{ width: 360, height: 780 },
	{ width: 844, height: 390 },
];

const hudSlots = (layout: Layout): [string, Slot][] =>
	(
		[
			['spin', layout.spin],
			['auto', layout.auto],
			['turbo', layout.turbo],
			['menu', layout.menu],
			['balance', layout.balance],
			['bet', layout.bet],
			['minus', layout.minus],
			['plus', layout.plus],
			['win', layout.win],
			['buy', layout.buy],
			['ribbon', layout.ribbon as Slot],
		] as [string, Slot][]
	).filter(([, slot]) => Boolean(slot));

const box = (slot: Slot) => ({
	left: slot.x - slot.w / 2,
	right: slot.x + slot.w / 2,
	top: slot.y - slot.h / 2,
	bottom: slot.y + slot.h / 2,
});

const overlaps = (a: Slot, b: Slot) => {
	const p = box(a), q = box(b);
	return p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
};

describe.each(SIZES)('layout at $width x $height', (canvas) => {
	const layout = computeLayout(sdkLayoutType(canvas), canvas);

	it('keeps the reel frame on screen', () => {
		const frame = frameRect(layout);
		expect(frame.left).toBeGreaterThanOrEqual(0);
		expect(frame.right).toBeLessThanOrEqual(canvas.width);
		expect(frame.top).toBeGreaterThanOrEqual(0);
		expect(frame.bottom).toBeLessThanOrEqual(canvas.height);
	});

	it('keeps the crest on screen', () => {
		expect(layout.logo.y - layout.logo.h / 2).toBeGreaterThanOrEqual(0);
	});

	it('keeps every control on screen', () => {
		for (const [name, slot] of hudSlots(layout)) {
			const b = box(slot);
			expect(b.left, name).toBeGreaterThanOrEqual(0);
			expect(b.right, name).toBeLessThanOrEqual(canvas.width);
			expect(b.top, name).toBeGreaterThanOrEqual(0);
			expect(b.bottom, name).toBeLessThanOrEqual(canvas.height);
		}
	});

	it('never overlaps two controls', () => {
		const slots = hudSlots(layout);
		for (let i = 0; i < slots.length; i++) {
			for (let j = i + 1; j < slots.length; j++) {
				expect(overlaps(slots[i][1], slots[j][1]), `${slots[i][0]} vs ${slots[j][0]}`).toBe(false);
			}
		}
	});

	it('never covers the reels with a control', () => {
		const frame = frameRect(layout);
		const frameSlot = {
			x: (frame.left + frame.right) / 2,
			y: (frame.top + frame.bottom) / 2,
			w: frame.right - frame.left,
			h: frame.bottom - frame.top,
			scale: 1,
		};
		for (const [name, slot] of hudSlots(layout)) expect(overlaps(frameSlot, slot), name).toBe(false);
	});
});

describe('buy button', () => {
	it.each(SIZES)('is a 2:1 plaque at $width x $height', (canvas) => {
		const { buy } = computeLayout(sdkLayoutType(canvas), canvas);
		expect(buy.w / buy.h).toBeCloseTo(2);
	});

	it('stays a usable size in the 800 x 450 popout Stake checks', () => {
		const { buy } = computeLayout('landscape', { width: 800, height: 450 });
		expect(buy.h).toBeGreaterThanOrEqual(44);
	});
});

describe('Bonus Hunt ribbon', () => {
	it.each(SIZES)('stays on screen above the controls at $width x $height', (canvas) => {
		const layout = computeLayout(sdkLayoutType(canvas), canvas);
		if (layout.type === 'landscape') {
			expect(layout.ribbon).toBeNull();
			return;
		}
		const ribbon = layout.ribbon!;
		expect(ribbon.y - ribbon.h / 2).toBeGreaterThanOrEqual(0);
		expect(ribbon.y + ribbon.h / 2).toBeLessThanOrEqual(layout.rail!.y);
	});
});

describe('portrait phones', () => {
	it.each(PHONES.filter((c) => c.height > c.width))(
		'keep the controls in the bottom quarter at $width x $height',
		(canvas) => {
			const layout = computeLayout('portrait', canvas);
			expect(layout.rail.height / canvas.height).toBeLessThanOrEqual(0.27);
			expect(layout.rail.y).toBeGreaterThan(canvas.height * 0.7);
		},
	);

	it('fills the width with the reels', () => {
		const canvas = { width: 390, height: 844 };
		const frame = frameRect(computeLayout('portrait', canvas));
		expect(frame.right - frame.left).toBeGreaterThan(canvas.width * 0.9);
	});
});

describe('touch targets on phones', () => {
	it.each(PHONES)('are at least 44px at $width x $height', (canvas) => {
		const layout = computeLayout(sdkLayoutType(canvas), canvas);
		for (const name of ['spin', 'auto', 'turbo', 'menu', 'minus', 'plus'] as const) {
			expect(layout[name].w, name).toBeGreaterThanOrEqual(44);
		}
		expect(layout.buy.h, 'buy').toBeGreaterThanOrEqual(44);
	});
});
