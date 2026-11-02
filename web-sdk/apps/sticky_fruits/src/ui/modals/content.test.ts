import { describe, expect, it } from 'vitest';

import config from '../../game/config';
import { contentText, rulesContent } from './content';

const joined = (social: boolean) => contentText(rulesContent(social)).join('\n');

describe('rules: bonus features', () => {
	it.each([false, true])('lists every bought mode with its cost from the math (social %s)', (social) => {
		const text = joined(social);
		for (const mode of ['bonus', 'super', 'hunt'] as const) {
			expect(text).toContain(`${config.betModes[mode].cost}×`);
		}
		expect(text).toContain('THE PRIVATE ROOM');
		expect(text).toContain('THE HIGH-ROLLER ROOM');
		expect(text).toContain('BONUS HUNT');
	});

	it('states the RTP of every mode', () => {
		const section = rulesContent(false).sections.find((s) => s.id === 'features');
		const text = contentText({ title: '', sections: [section!] }).join('\n');
		expect(text.match(/96\.50%/g)?.length).toBeGreaterThanOrEqual(4);
	});

	it('no longer claims a single mode or scatter-only triggers', () => {
		const text = joined(false);
		expect(text).not.toContain('There is one game mode');
		expect(text).not.toContain('can only be triggered by landing');
	});

	it('says a bought round plays like a triggered one, apart from the Super head start', () => {
		expect(joined(false)).toContain('plays exactly like');
		expect(joined(false)).toContain('apart from the 2 Sticky Wilds');
	});

	it('says buying a bonus switches Bonus Hunt off', () => {
		expect(joined(false)).toContain('Buying a bonus switches BONUS HUNT off');
	});
});
