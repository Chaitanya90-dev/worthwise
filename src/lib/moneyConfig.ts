import { getDefaultCurrency, getDefaultLocale } from "./userPreferences";

export type ExchangeRatesMap = Record<string, number>;

export type MoneyConfig = {
  locale: string;
  baseCurrency: string;
  displayCurrency: string;
  exchangeRates: ExchangeRatesMap;
};

const normalizeCurrency = (value?: string | null) =>
  (value || getDefaultCurrency()).trim().toUpperCase();

const currentConfig: MoneyConfig = {
  locale: getDefaultLocale(),
  baseCurrency: getDefaultCurrency(),
  displayCurrency: getDefaultCurrency(),
  exchangeRates: {},
};

const sanitizeExchangeRates = (
  rates: ExchangeRatesMap | null | undefined,
  baseCurrency: string
) => {
  const sanitized: ExchangeRatesMap = {};
  Object.entries(rates ?? {}).forEach(([currency, rate]) => {
    const normalizedCurrency = normalizeCurrency(currency);
    const numericRate = Number(rate);
    if (
      normalizedCurrency !== baseCurrency &&
      Number.isFinite(numericRate) &&
      numericRate > 0
    ) {
      sanitized[normalizedCurrency] = numericRate;
    }
  });
  return sanitized;
};

export const setMoneyConfig = (next: Partial<MoneyConfig>) => {
  const locale = next.locale?.trim() || currentConfig.locale || getDefaultLocale();
  const baseCurrency = normalizeCurrency(next.baseCurrency ?? currentConfig.baseCurrency);
  const displayCurrency = normalizeCurrency(
    next.displayCurrency ?? currentConfig.displayCurrency ?? baseCurrency
  );
  currentConfig.locale = locale;
  currentConfig.baseCurrency = baseCurrency;
  currentConfig.displayCurrency = displayCurrency;
  currentConfig.exchangeRates = sanitizeExchangeRates(
    next.exchangeRates ?? currentConfig.exchangeRates,
    baseCurrency
  );
};

export const getMoneyConfig = (): MoneyConfig => ({
  locale: currentConfig.locale,
  baseCurrency: currentConfig.baseCurrency,
  displayCurrency: currentConfig.displayCurrency,
  exchangeRates: { ...currentConfig.exchangeRates },
});

export const getRateToBaseCurrency = (currency?: string | null) => {
  const normalizedCurrency = normalizeCurrency(currency);
  const { baseCurrency, exchangeRates } = currentConfig;
  if (normalizedCurrency === baseCurrency) {
    return 1;
  }
  return exchangeRates[normalizedCurrency] ?? null;
};

export const convertAmount = (
  amount: number,
  fromCurrency?: string | null,
  toCurrency?: string | null
) => {
  if (!Number.isFinite(amount)) {
    return null;
  }
  const normalizedFrom = normalizeCurrency(fromCurrency);
  const normalizedTo = normalizeCurrency(toCurrency ?? currentConfig.displayCurrency);
  if (normalizedFrom === normalizedTo) {
    return amount;
  }

  const fromRate = getRateToBaseCurrency(normalizedFrom);
  const toRate = getRateToBaseCurrency(normalizedTo);
  if (!fromRate || !toRate) {
    return null;
  }
  const amountInBase = amount * fromRate;
  return amountInBase / toRate;
};

export const getDisplayAmount = (amount: number, sourceCurrency?: string | null) =>
  convertAmount(amount, sourceCurrency ?? currentConfig.baseCurrency, currentConfig.displayCurrency);

export const getBaseCurrency = () => currentConfig.baseCurrency;
export const getDisplayCurrency = () => currentConfig.displayCurrency;
export const getDisplayLocale = () => currentConfig.locale;
export const normalizeMoneyCurrency = normalizeCurrency;
