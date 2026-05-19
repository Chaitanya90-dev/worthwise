import { useEffect, useMemo } from "react";
import { useAppSelector } from "../../app/hooks";
import { useGetPreferencesQuery } from "../../features/api/apiSlice";
import { setMoneyConfig } from "../../lib/moneyConfig";
import { getDefaultUserPreferences } from "../../lib/userPreferences";

export const MoneyConfigSync = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? "");
  const { data: preferences } = useGetPreferencesQuery(userId, {
    skip: !userId,
  });

  const defaults = useMemo(() => getDefaultUserPreferences(), []);

  useEffect(() => {
    const resolved = {
      ...defaults,
      ...(preferences ?? {}),
    };
    setMoneyConfig({
      locale: resolved.locale,
      baseCurrency: resolved.base_currency,
      displayCurrency: resolved.display_currency,
      exchangeRates: resolved.exchange_rates,
    });
  }, [defaults, preferences]);

  return null;
};
