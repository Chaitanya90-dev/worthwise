import {
  Checkbox,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMemo } from "react";
import type { CsvMapping } from "../../../lib/transactionImport";

type SelectOption = { value: string; label: string };

type MappingSectionProps = {
  headers: string[];
  effectiveMapping: CsvMapping;
  categoryOptions: SelectOption[];
  paymentOptions: SelectOption[];
  accountOptions: SelectOption[];
  importDefaultCategory: string;
  importDefaultPayment: string;
  importDefaultAccount: string;
  importRecurring: boolean;
  onMappingChange: (field: keyof CsvMapping, value: string | null) => void;
  onDefaultCategoryChange: (value: string | null) => void;
  onDefaultPaymentChange: (value: string | null) => void;
  onDefaultAccountChange: (value: string | null) => void;
  onRecurringChange: (checked: boolean) => void;
  hideColumnMapping?: boolean;
};

export const MappingSection = ({
  headers,
  effectiveMapping,
  categoryOptions,
  paymentOptions,
  accountOptions,
  importDefaultCategory,
  importDefaultPayment,
  importDefaultAccount,
  importRecurring,
  onMappingChange,
  onDefaultCategoryChange,
  onDefaultPaymentChange,
  onDefaultAccountChange,
  onRecurringChange,
  hideColumnMapping = false,
}: MappingSectionProps) => {
  const columnOptions = useMemo(
    () =>
      headers.map((header, index) => ({
        value: String(index),
        label: header,
      })),
    [headers],
  );

  return (
    <Stack gap="xs">
      {!hideColumnMapping ? (
        <>
          <Group justify="space-between" align="center" wrap="wrap">
            <Title order={5}>Column mapping</Title>
            <Text size="xs" c="dimmed">
              Map at least Date and Amount (or Debit/Credit).
            </Text>
          </Group>
          {headers.length === 0 ? (
            <Text size="sm" c="dimmed">
              Upload or paste a CSV to map columns.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
              <Select
                label="Date"
                data={columnOptions}
                value={effectiveMapping.date || null}
                onChange={(value) => onMappingChange("date", value)}
                clearable
              />
              <Select
                label="Amount"
                data={columnOptions}
                value={effectiveMapping.amount || null}
                onChange={(value) => onMappingChange("amount", value)}
                clearable
              />
              <Select
                label="Debit"
                data={columnOptions}
                value={effectiveMapping.debit || null}
                onChange={(value) => onMappingChange("debit", value)}
                clearable
              />
              <Select
                label="Credit"
                data={columnOptions}
                value={effectiveMapping.credit || null}
                onChange={(value) => onMappingChange("credit", value)}
                clearable
              />
              <Select
                label="Type"
                data={columnOptions}
                value={effectiveMapping.type || null}
                onChange={(value) => onMappingChange("type", value)}
                clearable
              />
              <Select
                label="Category"
                data={columnOptions}
                value={effectiveMapping.category || null}
                onChange={(value) => onMappingChange("category", value)}
                clearable
              />
              <Select
                label="Payment method"
                data={columnOptions}
                value={effectiveMapping.payment || null}
                onChange={(value) => onMappingChange("payment", value)}
                clearable
              />
              <Select
                label="Merchant / payee / place"
                data={columnOptions}
                value={effectiveMapping.merchant || null}
                onChange={(value) => onMappingChange("merchant", value)}
                clearable
              />
              <Select
                label="Notes"
                data={columnOptions}
                value={effectiveMapping.notes || null}
                onChange={(value) => onMappingChange("notes", value)}
                clearable
              />
              <Select
                label="Tags"
                data={columnOptions}
                value={effectiveMapping.tags || null}
                onChange={(value) => onMappingChange("tags", value)}
                clearable
              />
              <Select
                label="Account"
                data={columnOptions}
                value={effectiveMapping.account || null}
                onChange={(value) => onMappingChange("account", value)}
                clearable
              />
            </SimpleGrid>
          )}
        </>
      ) : null}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Select
          label="Default category"
          data={categoryOptions}
          value={importDefaultCategory || null}
          onChange={onDefaultCategoryChange}
          placeholder="Uncategorized"
          clearable
        />
        <Select
          label="Default payment method"
          data={paymentOptions}
          value={importDefaultPayment || null}
          onChange={onDefaultPaymentChange}
          placeholder="Unspecified"
          clearable
        />
        <Select
          label="Default account"
          data={accountOptions}
          value={importDefaultAccount || null}
          onChange={onDefaultAccountChange}
          placeholder="Unspecified"
          clearable
        />
      </SimpleGrid>
      <Checkbox
        label="Mark all as recurring (monthly)"
        checked={importRecurring}
        onChange={(event) => onRecurringChange(event.currentTarget.checked)}
      />
    </Stack>
  );
};
