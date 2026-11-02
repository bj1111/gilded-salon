import { stateBet, stateI18n } from 'state-shared';
import { bookEventAmountToNormalisedAmount } from 'utils-shared/amount';

import { formatMoney } from '../presentation/money';

// Amounts in the player's currency and locale (see presentation/money.ts).
const locale = () => stateI18n.i18n?.locale || 'en';

export const money = (value: number, precisionOf = value) => formatMoney(value, stateBet.currency, locale(), precisionOf);

// book amounts are bet multiples x100; `precisionOfBook` is the book amount a count-up runs to
export const bookMoney = (bookAmount: number, precisionOfBook = bookAmount) =>
	money(bookEventAmountToNormalisedAmount(bookAmount), bookEventAmountToNormalisedAmount(precisionOfBook));
