import type { UserPreferences } from "../types/finance";

const FALLBACK_TIMEZONE = "UTC";
const FALLBACK_LOCALE = "en-US";
const FALLBACK_CURRENCY = "USD";

const REGION_CURRENCY_MAP: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  IE: "EUR",
  FR: "EUR",
  DE: "EUR",
  ES: "EUR",
  IT: "EUR",
  PT: "EUR",
  NL: "EUR",
  BE: "EUR",
  LU: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
  CY: "EUR",
  MT: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  SK: "EUR",
  SI: "EUR",
  HR: "EUR",
  IN: "INR",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  CN: "CNY",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  ZA: "ZAR",
  KE: "KES",
  NG: "NGN",
  AE: "AED",
  SG: "SGD",
  BR: "BRL",
  MX: "MXN",
};

export const getDefaultTimezone = () => {
  if (typeof Intl === "undefined") {
    return FALLBACK_TIMEZONE;
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
};

export const getDefaultLocale = () => {
  if (typeof navigator === "undefined") {
    return FALLBACK_LOCALE;
  }
  return navigator.language || FALLBACK_LOCALE;
};

export const inferCurrencyFromLocale = (locale: string) => {
  const normalizedLocale = locale.trim();
  if (!normalizedLocale) {
    return FALLBACK_CURRENCY;
  }

  const regionMatch = normalizedLocale.match(/[-_]([A-Za-z]{2})(?:$|[-_])/);
  const region = regionMatch?.[1]?.toUpperCase();
  if (region && REGION_CURRENCY_MAP[region]) {
    return REGION_CURRENCY_MAP[region];
  }

  return FALLBACK_CURRENCY;
};

export const getDefaultCurrency = (locale = getDefaultLocale()) =>
  inferCurrencyFromLocale(locale);

export const getDefaultUserPreferences = (): Omit<
  UserPreferences,
  "user_id" | "weekly_summary_last_sent_at" | "is_readonly" | "telegram_chat_id"
> => {
  const locale = getDefaultLocale();
  const defaultCurrency = getDefaultCurrency(locale);

  return {
    weekly_summary_enabled: false,
    weekly_summary_day: 1,
    weekly_summary_time: "08:00",
    weekly_summary_timezone: getDefaultTimezone(),
    locale,
    base_currency: defaultCurrency,
    display_currency: defaultCurrency,
    exchange_rates: {},
  };
};
