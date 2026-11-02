import { setContextEventEmitter, getContextEventEmitter } from 'utils-event-emitter';
import { setContextXstate, getContextXstate } from 'utils-xstate';
import { setContextLayout, getContextLayout } from 'utils-layout';
import { setContextApp, getContextApp } from 'pixi-svelte';
import { stateBet, stateMeta } from 'state-shared';

import { eventEmitter, type EmitterEvent } from './eventEmitter';
import { stateXstate, stateXstateDerived } from './stateXstate';
import { stateLayout, stateLayoutDerived } from './stateLayout';
import { stateApp } from './stateApp';

import { stateGame, stateGameDerived } from './stateGame.svelte';
import { i18nDerived } from '../i18n/i18nDerived';
import { copy } from '../i18n/copyData';
import { buildBetModeMeta } from '../buy/betModes';
import config from './config';

export const setContext = () => {
	// replays never call authenticate, so take the round's currency from the launch URL
	const urlCurrency = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('currency');
	if (urlCurrency) stateBet.currency = urlCurrency;
	// The modes the math publishes (base, bonus, super, hunt), replacing the SDK's sample ones.
	// Labels are rebuilt reactively in the HUD; social wording is not known until authenticate.
	stateMeta.betModeMeta = buildBetModeMeta(config, copy(false));
	setContextEventEmitter<EmitterEvent>({ eventEmitter });
	setContextXstate({ stateXstate, stateXstateDerived });
	setContextLayout({ stateLayout, stateLayoutDerived });
	setContextApp({ stateApp });
};

export const getContext = () => ({
	...getContextEventEmitter<EmitterEvent>(),
	...getContextLayout(),
	...getContextXstate(),
	...getContextApp(),
	stateGame,
	stateGameDerived,
	i18nDerived,
});
