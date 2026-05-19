import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppSelector } from "../../app/hooks";
import {
  useGetPreferencesQuery,
  useUpsertPreferencesMutation,
} from "../../features/api/preferencesApi";
import { getDefaultUserPreferences } from "../../lib/userPreferences";

export const TelegramSettings = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? "");
  const { data: preferences } = useGetPreferencesQuery(userId);
  const [upsertPreferences, { isLoading }] = useUpsertPreferencesMutation();
  const [error, setError] = useState<string | null>(null);
  const defaults = getDefaultUserPreferences();

  const [chatIdInput, setChatIdInput] = useState<string>("");

  useEffect(() => {
    if (preferences?.telegram_chat_id) {
      // Use queueMicrotask to avoid React strict mode cascading render warnings
      queueMicrotask(() =>
        setChatIdInput(String(preferences.telegram_chat_id)),
      );
    }
  }, [preferences?.telegram_chat_id]);

  const handleSave = async () => {
    if (!userId) return;
    setError(null);

    const parsedId = chatIdInput.trim() ? Number(chatIdInput.trim()) : null;

    if (chatIdInput.trim() && isNaN(parsedId as number)) {
      setError("Chat ID must be a valid number.");
      return;
    }

    try {
      await upsertPreferences({
        user_id: userId,
        weekly_summary_enabled:
          preferences?.weekly_summary_enabled ?? defaults.weekly_summary_enabled,
        weekly_summary_day:
          preferences?.weekly_summary_day ?? defaults.weekly_summary_day,
        weekly_summary_time:
          preferences?.weekly_summary_time ?? defaults.weekly_summary_time,
        weekly_summary_timezone:
          preferences?.weekly_summary_timezone ?? defaults.weekly_summary_timezone,
        locale: preferences?.locale ?? defaults.locale,
        base_currency: preferences?.base_currency ?? defaults.base_currency,
        display_currency:
          preferences?.display_currency ?? defaults.display_currency,
        exchange_rates: preferences?.exchange_rates ?? defaults.exchange_rates,
        telegram_chat_id: parsedId,
      }).unwrap();
    } catch {
      setError("Unable to save Telegram configuration.");
    }
  };

  const isConnected = !!preferences?.telegram_chat_id;

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Stack gap={2}>
          <Title order={4}>Connect Telegram</Title>
          <Text size="sm" c="dimmed">
            Log transactions automatically by messaging our Telegram Bot.
          </Text>
        </Stack>
        <Badge variant="light" color={isConnected ? "teal" : "gray"}>
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </Group>

      <Stack gap="sm" mt="sm">
        <Alert variant="light" color="blue" title="How to connect">
          1. Message our bot on Telegram to get your unique Chat ID.
          <br />
          2. Paste the Chat ID below and save.
          <br />
          3. Expense syntax:
          <br />
          <code>
            24.50 at Blue Bottle for coffee via Main checking category Food tags
            cafe,work
          </code>
          <br />
          4. Income syntax:
          <br />
          <code>
            received 2400 from ACME Payroll into Main checking via bank transfer
            category Salary tags march,payroll
          </code>
          <br />
          5. Strict syntax (least ambiguity):
          <br />
          <code>
            amt=24.50; merchant=Blue Bottle; notes=coffee; account=Main checking;
            payment=debit card; category=Food; tags=cafe,work
          </code>
          <br />
          You can also use hashtags like <code>#cafe #work</code>.
          <br />
          Commands: <code>/help</code>, <code>/examples</code>, <code>/status</code>.
        </Alert>

        <Group align="flex-end">
          <TextInput
            label="Telegram Chat ID"
            placeholder="e.g. 123456789"
            value={chatIdInput}
            onChange={(e) => setChatIdInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button
            variant="light"
            color="indigo"
            onClick={handleSave}
            loading={isLoading}
            leftSection={<MessageCircle size={16} />}
          >
            {isConnected ? "Update ID" : "Connect"}
          </Button>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};
