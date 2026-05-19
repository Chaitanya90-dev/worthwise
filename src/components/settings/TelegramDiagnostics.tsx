import {
  Badge,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { Download, RefreshCcw } from "lucide-react";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import type { TelegramIngestEvent, TelegramIngestStatus } from "../../types/finance";
import { useGetTelegramIngestEventsQuery } from "../../features/api/apiSlice";
import { formatMoney } from "../../lib/format";
import { SectionCard } from "./SectionCard";

const STATUS_OPTIONS: Array<{
  value: TelegramIngestStatus | "all";
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "parse_failed", label: "Parse failed" },
  { value: "insert_failed", label: "Insert failed" },
  { value: "error", label: "Function error" },
  { value: "success", label: "Success" },
  { value: "unlinked_chat", label: "Unlinked chat" },
];

const getStatusColor = (status: TelegramIngestStatus) => {
  if (status === "success") return "teal";
  if (status === "parse_failed" || status === "insert_failed" || status === "error") {
    return "red";
  }
  return "gray";
};

const escapeCsvValue = (value: string) => {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

const downloadCsv = (filename: string, rows: string[][]) => {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document?.createElement("a");
  if (!link) {
    URL.revokeObjectURL(url);
    return;
  }
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const readParsedData = (event: TelegramIngestEvent) => {
  if (!event.parsed_payload || typeof event.parsed_payload !== "object") {
    return {
      amount: null as number | null,
      merchant: null as string | null,
      type: null as string | null,
      categoryHint: null as string | null,
      paymentHint: null as string | null,
      accountHint: null as string | null,
    };
  }

  const payload = event.parsed_payload as Record<string, unknown>;
  const source =
    payload.parsed && typeof payload.parsed === "object"
      ? (payload.parsed as Record<string, unknown>)
      : payload;

  const amountRaw = source.amount;
  const merchantRaw = source.merchant;
  const typeRaw = source.type;
  const categoryHintRaw = source.categoryHint;
  const paymentHintRaw = source.paymentHint;
  const accountHintRaw = source.accountHint;

  return {
    amount: typeof amountRaw === "number" ? amountRaw : null,
    merchant: typeof merchantRaw === "string" ? merchantRaw : null,
    type: typeof typeRaw === "string" ? typeRaw : null,
    categoryHint: typeof categoryHintRaw === "string" ? categoryHintRaw : null,
    paymentHint: typeof paymentHintRaw === "string" ? paymentHintRaw : null,
    accountHint: typeof accountHintRaw === "string" ? accountHintRaw : null,
  };
};

export const TelegramDiagnostics = () => {
  const [status, setStatus] = useState<TelegramIngestStatus | "all">("all");

  const {
    data: events = [],
    isFetching,
    isLoading,
    error,
    refetch,
  } = useGetTelegramIngestEventsQuery(
    {
      limit: 50,
      status,
    },
    {
      pollingInterval: 15000,
      refetchOnFocus: true,
    },
  );

  const stats = useMemo(() => {
    let failed = 0;
    let success = 0;
    const failureReasons = new Map<string, number>();
    events.forEach((event) => {
      if (event.parse_status === "success") {
        success += 1;
      } else if (
        event.parse_status === "parse_failed" ||
        event.parse_status === "insert_failed" ||
        event.parse_status === "error"
      ) {
        failed += 1;
        const reason = event.error_text?.trim() || "unknown_error";
        failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
      }
    });
    return {
      total: events.length,
      success,
      failed,
      failureReasons: Array.from(failureReasons.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
    };
  }, [events]);

  const handleExportFailures = () => {
    const failedEvents = events.filter(
      (event) =>
        event.parse_status === "parse_failed" ||
        event.parse_status === "insert_failed" ||
        event.parse_status === "error",
    );

    if (failedEvents.length === 0) {
      return;
    }

    const rows = failedEvents.map((event) => {
      const parsed = readParsedData(event);
      return [
        event.created_at,
        event.parse_status,
        event.message_text ?? "",
        parsed.type ?? "",
        parsed.amount !== null ? String(parsed.amount) : "",
        parsed.merchant ?? "",
        parsed.categoryHint ?? "",
        parsed.paymentHint ?? "",
        parsed.accountHint ?? "",
        event.error_text ?? "",
      ];
    });

    downloadCsv("cashcove-telegram-failures.csv", [
      [
        "created_at",
        "parse_status",
        "message_text",
        "parsed_type",
        "parsed_amount",
        "parsed_merchant",
        "parsed_category_hint",
        "parsed_payment_hint",
        "parsed_account_hint",
        "error_text",
      ],
      ...rows,
    ]);
  };

  return (
    <SectionCard
      title="Telegram parser diagnostics"
      description="Recent parser outcomes from real Telegram chats for failure tuning."
      badge={`${stats.total} rows`}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Group gap="xs" align="center">
            <Badge color="teal" variant="light">
              {stats.success} success
            </Badge>
            <Badge color={stats.failed > 0 ? "red" : "gray"} variant="light">
              {stats.failed} failed
            </Badge>
            {stats.failureReasons.map(([reason, count]) => (
              <Badge key={reason} color="orange" variant="light">
                {reason} {count}
              </Badge>
            ))}
          </Group>
          <Group gap="xs" align="flex-end">
            <Select
              label="Status"
              data={STATUS_OPTIONS}
              value={status}
              onChange={(value) =>
                setStatus((value as TelegramIngestStatus | "all") ?? "all")
              }
              w={180}
            />
            <Button
              variant="light"
              leftSection={<RefreshCcw size={16} />}
              onClick={() => refetch()}
              loading={isFetching}
            >
              Refresh
            </Button>
            <Button
              variant="light"
              color="gray"
              leftSection={<Download size={16} />}
              onClick={handleExportFailures}
              disabled={stats.failed === 0}
            >
              Export failures
            </Button>
          </Group>
        </Group>

        {isLoading ? (
          <Group py="sm">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Loading recent Telegram events...
            </Text>
          </Group>
        ) : null}

        {error ? (
          <Text size="sm" c="red">
            Failed to load Telegram diagnostics.
          </Text>
        ) : null}

        {!isLoading && !error && events.length === 0 ? (
          <Text size="sm" c="dimmed">
            No events captured yet. Send a real Telegram message to start collecting
            parser outcomes.
          </Text>
        ) : null}

        {!isLoading && !error && events.length > 0 ? (
          <Table horizontalSpacing="md" verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Message</Table.Th>
                <Table.Th>Parsed</Table.Th>
                <Table.Th>Error</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {events.map((event) => {
                const parsed = readParsedData(event);
                const parsedLabelParts = [
                  parsed.type,
                  parsed.amount !== null ? formatMoney(parsed.amount) : null,
                  parsed.merchant,
                ].filter(Boolean);
                const hintLabelParts = [
                  parsed.categoryHint ? `cat ${parsed.categoryHint}` : null,
                  parsed.paymentHint ? `pay ${parsed.paymentHint}` : null,
                  parsed.accountHint ? `acct ${parsed.accountHint}` : null,
                ].filter(Boolean);
                return (
                  <Table.Tr key={event.id}>
                    <Table.Td>
                      <Text size="sm">
                        {dayjs(event.created_at).format("DD MMM HH:mm:ss")}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={getStatusColor(event.parse_status)}
                      >
                        {event.parse_status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2}>
                        {event.message_text ?? "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm" lineClamp={1}>
                          {parsedLabelParts.length > 0 ? parsedLabelParts.join(" • ") : "-"}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {hintLabelParts.length > 0 ? hintLabelParts.join(" • ") : "No structured hints"}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={event.error_text ? "red" : "dimmed"} lineClamp={2}>
                        {event.error_text ?? "-"}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        ) : null}
      </Stack>
    </SectionCard>
  );
};
