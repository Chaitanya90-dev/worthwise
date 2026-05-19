import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { MailCheck, MailPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import {
  useGetPreferencesQuery,
  useUpsertPreferencesMutation,
} from "../../features/api/apiSlice";
import { getDefaultUserPreferences } from "../../lib/userPreferences";

const dayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export const NotificationSettings = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? "");
  const { data: preferences } = useGetPreferencesQuery(userId);
  const [upsertPreferences, { isLoading }] = useUpsertPreferencesMutation();
  const [error, setError] = useState<string | null>(null);

  const defaults = useMemo(() => getDefaultUserPreferences(), []);
  const [draft, setDraft] = useState<
    Partial<{
      weekly_summary_enabled: boolean;
      weekly_summary_day: number;
      weekly_summary_time: string;
      weekly_summary_timezone: string;
    }> | null
  >(null);

  const resolved = useMemo(
    () => ({
      ...defaults,
      ...(preferences ?? {}),
      ...(draft ?? {}),
    }),
    [defaults, draft, preferences]
  );

  const handleSave = async () => {
    if (!userId) {
      return;
    }
    setError(null);
    try {
      await upsertPreferences({
        user_id: userId,
        weekly_summary_enabled: resolved.weekly_summary_enabled,
        weekly_summary_day: resolved.weekly_summary_day,
        weekly_summary_time: resolved.weekly_summary_time,
        weekly_summary_timezone: resolved.weekly_summary_timezone,
        locale: resolved.locale,
        base_currency: resolved.base_currency,
        display_currency: resolved.display_currency,
        exchange_rates: resolved.exchange_rates,
      }).unwrap();
      setDraft(null);
    } catch {
      setError("Unable to save notification settings.");
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Stack gap={2}>
          <Title order={4}>Weekly summary email</Title>
          <Text size="sm" c="dimmed">
            Receive a weekly recap with spend highlights and upcoming bills.
          </Text>
        </Stack>
        <Badge
          variant="light"
          color={resolved.weekly_summary_enabled ? "teal" : "gray"}
        >
          {resolved.weekly_summary_enabled ? "Enabled" : "Disabled"}
        </Badge>
      </Group>
      <Stack gap="sm" mt="sm">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600}>
            Email summary
          </Text>
          <Switch
            checked={resolved.weekly_summary_enabled}
            onChange={(event) =>
              setDraft((prev) => ({
                ...(prev ?? {}),
                weekly_summary_enabled: event.currentTarget.checked,
              }))
            }
            size="sm"
            label={resolved.weekly_summary_enabled ? "On" : "Off"}
          />
        </Group>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <Select
            label="Day"
            data={dayOptions}
            value={String(resolved.weekly_summary_day)}
            onChange={(value) =>
              setDraft((prev) => ({
                ...(prev ?? {}),
                weekly_summary_day: value ? Number(value) : 1,
              }))
            }
            disabled={!resolved.weekly_summary_enabled}
            size="sm"
          />
          <TextInput
            label="Time"
            type="time"
            value={resolved.weekly_summary_time}
            onChange={(event) =>
              setDraft((prev) => ({
                ...(prev ?? {}),
                weekly_summary_time: event.target.value,
              }))
            }
            disabled={!resolved.weekly_summary_enabled}
            size="sm"
            style={{ minWidth: 130 }}
          />
          <TextInput
            label="Timezone"
            value={resolved.weekly_summary_timezone}
            onChange={(event) =>
              setDraft((prev) => ({
                ...(prev ?? {}),
                weekly_summary_timezone: event.target.value,
              }))
            }
            disabled={!resolved.weekly_summary_enabled}
            size="sm"
            style={{ minWidth: 200 }}
          />
        </Group>
        <Text size="xs" c="dimmed">
          We’ll send the summary every{" "}
          {dayOptions.find((item) => item.value === String(resolved.weekly_summary_day))
            ?.label}{" "}
          at {resolved.weekly_summary_time} ({resolved.weekly_summary_timezone}).
        </Text>
        <Text size="xs" c="dimmed">
          Delivery runs via the configured Netlify scheduled job and Resend sender address.
        </Text>
        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button
            variant="light"
            leftSection={
              resolved.weekly_summary_enabled ? (
                <MailCheck size={16} />
              ) : (
                <MailPlus size={16} />
              )
            }
            onClick={handleSave}
            loading={isLoading}
          >
            Save schedule
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
};
