import {
  Alert,
  Autocomplete,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import {
  useGetPreferencesQuery,
  useUpsertPreferencesMutation,
} from "../../features/api/apiSlice";
import { getDefaultUserPreferences } from "../../lib/userPreferences";

const localeOptions = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-IN", label: "English (India)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "sw-KE", label: "Swahili (Kenya)" },
].map((item) => item.value);

const currencyOptions = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CNY",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "ZAR",
  "KES",
  "NGN",
  "AED",
  "SGD",
];

type RateRow = {
  currency: string;
  rate: string;
};

export const MonetarySettings = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? "");
  const { data: preferences } = useGetPreferencesQuery(userId);
  const [upsertPreferences, { isLoading }] = useUpsertPreferencesMutation();
  const [error, setError] = useState<string | null>(null);

  const defaults = useMemo(() => getDefaultUserPreferences(), []);
  const resolved = useMemo(
    () => ({
      ...defaults,
      ...(preferences ?? {}),
    }),
    [defaults, preferences]
  );

  const [locale, setLocale] = useState(resolved.locale);
  const [baseCurrency, setBaseCurrency] = useState(resolved.base_currency);
  const [displayCurrency, setDisplayCurrency] = useState(resolved.display_currency);
  const [rateRows, setRateRows] = useState<RateRow[]>(() =>
    Object.entries(resolved.exchange_rates ?? {}).map(([currency, rate]) => ({
      currency,
      rate: String(rate),
    }))
  );

  useEffect(() => {
    setLocale(resolved.locale);
    setBaseCurrency(resolved.base_currency);
    setDisplayCurrency(resolved.display_currency);
    setRateRows(
      Object.entries(resolved.exchange_rates ?? {}).map(([currency, rate]) => ({
        currency,
        rate: String(rate),
      }))
    );
  }, [
    resolved.base_currency,
    resolved.display_currency,
    resolved.exchange_rates,
    resolved.locale,
  ]);

  const handleAddRate = () => {
    setRateRows((prev) => [...prev, { currency: "", rate: "" }]);
  };

  const handleRateChange = (
    index: number,
    key: keyof RateRow,
    value: string
  ) => {
    setRateRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row
      )
    );
  };

  const handleDeleteRate = (index: number) => {
    setRateRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleSave = async () => {
    if (!userId) {
      return;
    }

    setError(null);
    const normalizedLocale = locale.trim();
    const normalizedBaseCurrency = baseCurrency.trim().toUpperCase();
    const normalizedDisplayCurrency = displayCurrency.trim().toUpperCase();

    if (!normalizedLocale) {
      setError("Enter a valid locale code like en-US or fr-FR.");
      return;
    }
    try {
      new Intl.NumberFormat(normalizedLocale).format(1234.56);
    } catch {
      setError("Enter a valid locale code like en-US or fr-FR.");
      return;
    }

    if (!/^[A-Z]{3}$/.test(normalizedBaseCurrency)) {
      setError("Base currency must be a 3-letter ISO currency code.");
      return;
    }
    if (!/^[A-Z]{3}$/.test(normalizedDisplayCurrency)) {
      setError("Display currency must be a 3-letter ISO currency code.");
      return;
    }

    const exchangeRates: Record<string, number> = {};
    for (const row of rateRows) {
      const currency = row.currency.trim().toUpperCase();
      if (!currency) {
        continue;
      }
      if (!/^[A-Z]{3}$/.test(currency)) {
        setError("Every FX rate row needs a 3-letter ISO currency code.");
        return;
      }
      if (currency === normalizedBaseCurrency) {
        setError(`Do not add an FX rate for the base currency (${normalizedBaseCurrency}).`);
        return;
      }
      const rate = Number(row.rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        setError(`Enter a valid positive FX rate for ${currency}.`);
        return;
      }
      exchangeRates[currency] = rate;
    }

    try {
      await upsertPreferences({
        user_id: userId,
        weekly_summary_enabled: resolved.weekly_summary_enabled,
        weekly_summary_day: resolved.weekly_summary_day,
        weekly_summary_time: resolved.weekly_summary_time,
        weekly_summary_timezone: resolved.weekly_summary_timezone,
        locale: normalizedLocale,
        base_currency: normalizedBaseCurrency,
        display_currency: normalizedDisplayCurrency,
        exchange_rates: exchangeRates,
        telegram_chat_id: resolved.telegram_chat_id ?? null,
      }).unwrap();
    } catch {
      setError("Unable to save monetary settings.");
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={4}>Locale and currency</Title>
          <Text size="sm" c="dimmed">
            Configure how money is displayed across the app. Base currency is used
            for budgets, goals, and planning totals. Display currency is what the UI
            shows after conversion.
          </Text>
        </Stack>
        <Group align="flex-end" wrap="wrap">
          <Autocomplete
            label="Locale"
            data={localeOptions}
            value={locale}
            onChange={setLocale}
            placeholder="e.g. en-US"
            style={{ minWidth: 240 }}
          />
          <Autocomplete
            label="Base currency"
            data={currencyOptions}
            value={baseCurrency}
            onChange={(value) => {
              const next = value.toUpperCase();
              setBaseCurrency(next);
              setRateRows((prev) =>
                prev.filter((row) => row.currency.trim().toUpperCase() !== next)
              );
            }}
            placeholder="e.g. USD"
            style={{ minWidth: 160 }}
          />
          <Autocomplete
            label="Display currency"
            data={currencyOptions}
            value={displayCurrency}
            onChange={(value) => setDisplayCurrency(value.toUpperCase())}
            placeholder="e.g. EUR"
            style={{ minWidth: 160 }}
          />
        </Group>
        <Stack gap={6}>
          <Group justify="space-between" align="center">
            <Text size="sm" fw={600}>
              Manual FX rates
            </Text>
            <Button
              variant="light"
              size="xs"
              leftSection={<Plus size={14} />}
              onClick={handleAddRate}
            >
              Add rate
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Enter the value of 1 unit of each currency in {baseCurrency}. Example:
            if base currency is {baseCurrency}, then EUR = 1.08 means 1 EUR = 1.08 {baseCurrency}.
          </Text>
          <Table.ScrollContainer minWidth={520}>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Currency</Table.Th>
                  <Table.Th>Value in {baseCurrency}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rateRows.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text size="sm" c="dimmed">
                        No FX rates yet. Add the currencies you actively use.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  rateRows.map((row, index) => (
                    <Table.Tr key={`${row.currency}-${index}`}>
                      <Table.Td>
                        <Autocomplete
                          data={currencyOptions}
                          value={row.currency}
                          onChange={(value) =>
                            handleRateChange(index, "currency", value.toUpperCase())
                          }
                          placeholder="Currency"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.rate}
                          onChange={(event) =>
                            handleRateChange(index, "rate", event.target.value)
                          }
                          placeholder="0"
                          type="number"
                          min="0"
                          step="0.000001"
                        />
                      </Table.Td>
                      <Table.Td style={{ width: 64 }}>
                        <Button
                          variant="subtle"
                          color="red"
                          size="xs"
                          onClick={() => handleDeleteRate(index)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button onClick={handleSave} loading={isLoading}>
            Save locale and FX settings
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
};
