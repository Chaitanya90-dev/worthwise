import {
  Alert,
  Badge,
  FileInput,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import type { PdfStatementLineResult } from "../../../lib/pdfStatementParser";

type PdfInputSectionProps = {
  pdfFile: File | null;
  pdfRaw: string;
  pdfExtracting: boolean;
  importDefaultType: "expense" | "income";
  importDefaultTags: string;
  lines: PdfStatementLineResult[];
  onFileChange: (file: File | null) => void;
  onRawChange: (value: string) => void;
  onDefaultTypeChange: (value: string | null) => void;
  onDefaultTagsChange: (value: string) => void;
};

export const PdfInputSection = ({
  pdfFile,
  pdfRaw,
  pdfExtracting,
  importDefaultType,
  importDefaultTags,
  lines,
  onFileChange,
  onRawChange,
  onDefaultTypeChange,
  onDefaultTagsChange,
}: PdfInputSectionProps) => {
  const parsed = lines.filter((line) => line.status === "parsed").length;
  const failed = lines.filter((line) => line.status === "failed").length;
  const hasContent = pdfRaw.trim().length > 0;

  return (
    <Stack gap="xs">
      <Title order={5}>PDF statement</Title>
      <FileInput
        label="Upload PDF statement"
        placeholder="Choose a bank or card statement PDF"
        value={pdfFile}
        onChange={onFileChange}
        accept="application/pdf,.pdf"
        clearable
      />
      <Text size="xs" c="dimmed">
        Text-based PDFs are extracted locally in your browser. Scanned PDFs will
        still need OCR later, so you can also paste copied statement text below.
      </Text>
      <Textarea
        value={pdfRaw}
        onChange={(event) => onRawChange(event.currentTarget.value)}
        placeholder="Extracted statement text will appear here. You can also paste copied PDF text."
        minRows={8}
        resize="vertical"
        autosize
      />

      <Group gap="sm" wrap="wrap">
        <Select
          label="Fallback type"
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
        <Textarea
          label="Default tags (comma-separated)"
          placeholder="e.g. Statement import, Card"
          value={importDefaultTags}
          onChange={(event) => onDefaultTagsChange(event.currentTarget.value)}
          autosize
          minRows={1}
          maxRows={2}
          style={{ minWidth: 220, flex: 1 }}
          size="xs"
        />
      </Group>

      {pdfExtracting ? (
        <Alert color="blue" variant="light" title="Extracting PDF text">
          Reading content streams from the uploaded statement.
        </Alert>
      ) : null}

      {hasContent ? (
        <Group gap="xs" wrap="wrap">
          <Badge variant="light" color="blue" size="sm">
            {lines.length} candidate rows
          </Badge>
          <Badge variant="light" color="green" size="sm">
            {parsed} parsed
          </Badge>
          {failed > 0 ? (
            <Badge variant="light" color="yellow" size="sm">
              {failed} skipped
            </Badge>
          ) : null}
        </Group>
      ) : null}

      {hasContent && failed > 0 ? (
        <Alert
          color="yellow"
          variant="light"
          title={`${failed} line${failed === 1 ? "" : "s"} skipped`}
        >
          <Stack gap={4}>
            {lines
              .filter((line) => line.status === "failed")
              .slice(0, 5)
              .map((line) => (
                <Text key={line.lineNumber} size="xs" c="dimmed" lineClamp={1}>
                  Line {line.lineNumber}: {line.raw}
                </Text>
              ))}
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  );
};
