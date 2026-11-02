import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every event type the math emits must have a handler, otherwise the SDK logs an error and
// silently skips it (that is how freeSpinRetrigger went unpresented).
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.join(here, relative), 'utf8');

const handlerKeys = () =>
	new Set([...read('../game/bookEventHandlerMap.ts').matchAll(/^\t(\w+): async/gm)].map((m) => m[1]));

const bookEventTypes = () => {
	const types = new Set<string>();
	for (const file of ['base_books.ts', 'bonus_books.ts', 'maxwin_books.ts']) {
		for (const m of read(`../stories/data/${file}`).matchAll(/"type":"(\w+)"/g)) types.add(m[1]);
	}
	return types;
};

describe('book event coverage', () => {
	it('finds the math event types', () => {
		expect(bookEventTypes()).toContain('reveal');
		expect(bookEventTypes()).toContain('freeSpinRetrigger');
	});

	it('has a handler for every event type in the books', () => {
		const handlers = handlerKeys();
		const missing = [...bookEventTypes()].filter((type) => !handlers.has(type));
		expect(missing).toEqual([]);
	});
});
