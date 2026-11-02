import { createLayout } from 'utils-layout';

import { computeLayout } from '../ui/layout';

export const { stateLayout, stateLayoutDerived } = createLayout({
	backgroundRatio: {
		normal: 16 / 9,
		portrait: 9 / 16,
	},
	mainSizesMap: {
		desktop: { width: 1422, height: 800 },
		tablet: { width: 1000, height: 1000 },
		landscape: { width: 1600, height: 900 },
		portrait: { width: 800, height: 1422 },
	},
});

// Canvas-pixel positions of the board, crest and every control (see ui/layout.ts).
export const gameLayout = () =>
	computeLayout(stateLayoutDerived.layoutType(), stateLayoutDerived.canvasSizes());
