// Player-facing wording + the social-mode switch. The wording itself lives in `copyData.ts`
// (pure, unit-tested in node); this file only adds what needs the SDK runtime.

import { stateConfig, stateI18n, stateUrlDerived } from 'state-shared';

import { copy, socialSdkMessages } from './copyData';

export * from './copyData';

/**
 * Social (Stake.US) wording is on when either source says so:
 * - the `social=true` launch/replay URL param (`stateUrlDerived.social()`). This is the switch the
 *   platform documents ("The RGS uses the URL query parameter social=true/false") and the only
 *   one available in replay mode, which never calls /wallet/authenticate;
 * - `config.jurisdiction.socialCasino` from /wallet/authenticate, which the SDK's
 *   <Authenticate> copies into `stateConfig.jurisdiction`. The review prompt treats it as
 *   equivalent ("social=true (or config.jurisdiction.socialCasino is true)").
 * OR-ing both is the conservative choice. `jurisdiction` is optional-chained because
 * <Authenticate> assigns it straight from the response, which may omit it.
 */
export const isSocial = (): boolean =>
	stateUrlDerived.social() || stateConfig.jurisdiction?.socialCasino === true;

/** The copy for the current mode; reactive when read inside a template or `$derived`. */
export const copyNow = () => copy(isSocial());

/**
 * In social mode, replace the restricted words inside the SDK's own modals (BET MENU,
 * SELECT YOUR BET, the insufficient-funds autoplay message, ...) by merging `socialSdkMessages`
 * into the active lingui catalogue. Those components render `stateI18nDerived.translate(id)`,
 * so they pick the override up the next time they render. Idempotent; no-op outside social mode
 * or before the catalogue is loaded (<LoadI18n> loads it before the game mounts).
 */
export const applySocialSdkWording = () => {
	if (!isSocial()) return;
	const { i18n } = stateI18n;
	if (!i18n.locale) return;
	i18n.load(i18n.locale, socialSdkMessages);
};
