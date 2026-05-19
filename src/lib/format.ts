import {
  convertAmount,
  getBaseCurrency,
  getDisplayCurrency,
  getDisplayLocale,
  normalizeMoneyCurrency,
} from "./moneyConfig";

type CurrencyFormatOptions = {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  locale?: string;
};

export const formatCurrency = (
  value: number,
  currency: string,
  options: CurrencyFormatOptions = {}
) => {
  const normalizedCurrency = normalizeMoneyCurrency(currency);
  const defaultFractionDigits = normalizedCurrency === "INR" ? 0 : 2;
  const {
    maximumFractionDigits = defaultFractionDigits,
    minimumFractionDigits = normalizedCurrency === "INR" ? 0 : 2,
    locale = getDisplayLocale(),
  } = options;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits,
      minimumFractionDigits,
    }).format(value);
  } catch {
    return `${normalizedCurrency} ${value.toFixed(maximumFractionDigits)}`;
  }
};

export const formatMoney = (
  value: number,
  sourceCurrency?: string | null,
  options: CurrencyFormatOptions = {}
) => {
  const displayCurrency = getDisplayCurrency();
  const baseCurrency = getBaseCurrency();
  const effectiveSource = normalizeMoneyCurrency(sourceCurrency ?? baseCurrency);
  const converted = convertAmount(value, effectiveSource, displayCurrency);
  const formattedValue = converted ?? value;
  return formatCurrency(formattedValue, converted === null ? effectiveSource : displayCurrency, {
    ...options,
    maximumFractionDigits:
      options.maximumFractionDigits ??
      (displayCurrency === "INR" || effectiveSource === "INR" ? 0 : undefined),
    minimumFractionDigits:
      options.minimumFractionDigits ??
      (displayCurrency === "INR" || effectiveSource === "INR" ? 0 : undefined),
  });
};

export const formatINR = (value: number, sourceCurrency?: string | null) =>
  formatMoney(value, sourceCurrency, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });

export const formatNativeMoney = (
  value: number,
  currency: string,
  options: CurrencyFormatOptions = {}
) => formatCurrency(value, currency, options);

export const formatMonthLabel = (month: string) => {
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon) {
    return month;
  }
  const date = new Date(Date.UTC(year, mon - 1, 1));
  return date.toLocaleString(getDisplayLocale(), { month: "long", year: "numeric" });
};
