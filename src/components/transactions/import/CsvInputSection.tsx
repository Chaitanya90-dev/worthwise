import {
  Checkbox,
  FileInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { CSV_DELIMITERS, type CsvTemplate } from "../../../lib/transactionImport";

type CsvInputSectionProps = {
  importFile: File | null;
  importRaw: string;
  importDelimiter: string;
  importHasHeader: boolean;
  importDefaultType: "expense" | "income";
  importTemplateId: string;
  templates: CsvTemplate[];
  detectedDelimiter: string;
  onFileChange: (file: File | null) => void;
  onRawChange: (value: string) => void;
  onDelimiterChange: (value: string | null) => void;
  onHasHeaderChange: (checked: boolean) => void;
  onDefaultTypeChange: (value: string | null) => void;
  onTemplateChange: (value: string | null) => void;
};

export const CsvInputSection = ({
  importFile,
  importRaw,
  importDelimiter,
  importHasHeader,
  importDefaultType,
  importTemplateId,
  templates,
  detectedDelimiter,
  onFileChange,
  onRawChange,
  onDelimiterChange,
  onHasHeaderChange,
  onDefaultTypeChange,
  onTemplateChange,
}: CsvInputSectionProps) => {
  const delimiterLabel = detectedDelimiter === "\t" ? "Tab" : detectedDelimiter;
  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: template.label,
  }));

  return (
    <Stack gap="xs">
      <Title order={5}>CSV input</Title>
      <FileInput
        label="Upload CSV file"
        placeholder="Choose a CSV file"
        value={importFile}
        onChange={onFileChange}
        accept=".csv,text/csv"
        clearable
      />
      <Text size="xs" c="dimmed">
        Or paste CSV content below.
      </Text>
      <Textarea
        value={importRaw}
        onChange={(event) => onRawChange(event.target.value)}
        placeholder="Paste CSV data here"
        minRows={5}
        resize="vertical"
      />
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
        <Select
          label="Template"
          data={templateOptions}
          value={importTemplateId}
          onChange={onTemplateChange}
          allowDeselect={false}
        />
        <Select
          label="Delimiter"
          data={CSV_DELIMITERS}
          value={importDelimiter}
          onChange={onDelimiterChange}
          allowDeselect={false}
        />
        <Checkbox
          label="First row is header"
          checked={importHasHeader}
          onChange={(event) => onHasHeaderChange(event.currentTarget.checked)}
        />
        <Select
          label="Default type"
          data={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
          ]}
          value={importDefaultType}
          onChange={onDefaultTypeChange}
          allowDeselect={false}
        />
      </SimpleGrid>
      {importRaw.trim() ? (
        <Text size="xs" c="dimmed">
          Detected delimiter: {delimiterLabel}
        </Text>
      ) : null}
    </Stack>
  );
};
