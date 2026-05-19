import {
  Alert,
  Badge,
  Box,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  rem,
} from "@mantine/core";
import { useRef } from "react";
import type { SmartLineResult } from "../../../lib/smartTextParser";

type SmartPasteSectionProps = {
  smartRaw: string;
  onSmartRawChange: (value: string) => void;
  importDefaultType: "expense" | "income";
  importRecurring: boolean;
  onDefaultTypeChange: (value: string | null) => void;
  importDefaultTags: string;
  onDefaultTagsChange: (value: string) => void;
  lines: SmartLineResult[];
};

const LineNumberedTextarea = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) => {
  const lineCount = Math.max(value.split("\n").length, 6);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <Box
      style={{
        display: "flex",
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-sm)",
        overflow: "hidden",
        backgroundColor: "var(--mantine-color-body)",
      }}
    >
      <Box
        ref={lineNumbersRef}
        style={{
          padding: "calc(var(--mantine-spacing-sm) / 2 + 1px) 0",
          backgroundColor: "var(--mantine-color-default-hover)",
          borderRight: "1px solid var(--mantine-color-default-border)",
          color: "var(--mantine-color-dimmed)",
          textAlign: "right",
          fontFamily: "monospace",
          fontSize: "var(--mantine-font-size-xs)",
          lineHeight: 1.55,
          overflow: "hidden",
          width: rem(40),
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ paddingRight: 8, paddingLeft: 4 }}>
            {i + 1}
          </div>
        ))}
      </Box>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        minRows={6}
        maxRows={14}
        resize="vertical"
        autosize
        variant="unstyled"
        style={{ flex: 1 }}
        styles={{
          input: {
            fontFamily: "monospace",
            fontSize: "var(--mantine-font-size-xs)",
            lineHeight: 1.55,
            padding: "calc(var(--mantine-spacing-sm) / 2)",
            border: "none",
          },
        }}
      />
    </Box>
  );
};

export const SmartPasteSection = ({
  smartRaw,
  onSmartRawChange,
  importDefaultType,
  onDefaultTypeChange,
  importDefaultTags,
  onDefaultTagsChange,
  lines,
}: SmartPasteSectionProps) => {
  const parsed = lines.filter((l) => l.status === "parsed").length;
  const partial = lines.filter((l) => l.status === "partial").length;
  const failed = lines.filter((l) => l.status === "failed").length;
  const hasContent = smartRaw.trim().length > 0;

  return (
    <Stack gap="xs">
      <Title order={5}>Smart paste</Title>
      <Text size="xs" c="dimmed">
        Paste bank SMS alerts, UPI notifications, or quick notes. One
        transaction per line.
      </Text>
      <LineNumberedTextarea
        value={smartRaw}
        onChange={onSmartRawChange}
        placeholder={`Examples:\nUSD 42.50 paid to Uber via Visa debit on 2026-03-07\nYour credit card XX1004 was used for EUR 19.99 on Jan 27, 2026 at Spotify\nMar 5 lunch 25\nMar 6 hotel 350 cash`}
      />

      <Group gap="sm" wrap="wrap">
        <Select
          label="Default type"
          data={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
          ]}
          value={importDefaultType}
          onChange={onDefaultTypeChange}
          allowDeselect={false}
          style={{ minWidth: 140 }}
          size="xs"
        />
        <TextInput
          label="Default tags (comma-separated)"
          placeholder="e.g. Goa Trip, Cash"
          value={importDefaultTags}
          onChange={(e) => onDefaultTagsChange(e.currentTarget.value)}
          style={{ minWidth: 200, flex: 1 }}
          size="xs"
        />
      </Group>

      {hasContent && lines.length > 0 ? (
        <Group gap="xs">
          <Badge variant="light" color="blue" size="sm">
            {lines.length} lines
          </Badge>
          <Badge variant="light" color="green" size="sm">
            {parsed} parsed
          </Badge>
          {partial > 0 ? (
            <Badge variant="light" color="yellow" size="sm">
              {partial} partial
            </Badge>
          ) : null}
          {failed > 0 ? (
            <Badge variant="light" color="red" size="sm">
              {failed} failed
            </Badge>
          ) : null}
        </Group>
      ) : null}

      {hasContent && failed > 0 ? (
        <Alert
          color="yellow"
          variant="light"
          title={`${failed} line${failed > 1 ? "s" : ""} could not be parsed`}
        >
          <Stack gap={4}>
            {lines
              .filter((l) => l.status === "failed")
              .slice(0, 5)
              .map((l) => (
                <Text key={l.lineNumber} size="xs" c="dimmed" lineClamp={1}>
                  Line {l.lineNumber}: {l.raw}
                </Text>
              ))}
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  );
};
