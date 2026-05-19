import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMemo } from "react";
import dayjs from "dayjs";
import type { ColDef } from "ag-grid-community";
import { DatatrixTable } from "../../DatatrixTable";
import { formatINR } from "../../../lib/format";
import type {
  InvalidImportRow,
  ParsedImportRow,
} from "../../../lib/transactionImport";

type ImportResult = {
  success: number;
  failed: number;
  errors: string[];
};

type ImportProgress = {
  total: number;
  completed: number;
};

type PreviewSectionProps = {
  parsedRowCount: number;
  validRows: ParsedImportRow[];
  invalidRows: InvalidImportRow[];
  warnings: string[];
  importError: string | null;
  importResult: ImportResult | null;
  importProgress: ImportProgress | null;
  onExportErrors: (format: "csv" | "json") => void;
  onRetryFailedRows: () => void;
  canRetryFailedRows: boolean;
  showRetryHint: boolean;
  onRowEdit: (rowNumber: number, field: string, value: any) => void;
};

type PreviewRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  category: string;
  merchant: string;
  account: string;
  payment: string;
  notes: string;
  tags: string;
  status: string;
};

export const PreviewSection = ({
  parsedRowCount,
  validRows,
  invalidRows,
  warnings,
  importError,
  importResult,
  importProgress,
  onExportErrors,
  onRetryFailedRows,
  canRetryFailedRows,
  showRetryHint,
  onRowEdit,
}: PreviewSectionProps) => {
  const previewRows = useMemo<PreviewRow[]>(
    () =>
      validRows.map((row) => ({
        id: String(row.rowNumber),
        date: dayjs(row.preview.date).format("YYYY-MM-DD"), // Keep editable dates in standard format
        type: row.preview.type,
        amount: row.preview.amount,
        category: row.preview.category,
        merchant: row.preview.merchant,
        account: row.preview.account,
        payment: row.preview.payment,
        notes: row.preview.notes,
        tags: row.preview.tags,
        status: row.warnings.length ? "Check" : "Ok",
      })),
    [validRows],
  );

  const previewColumns = useMemo<ColDef<PreviewRow>[]>(
    () => [
      { headerName: "Date", field: "date", maxWidth: 130, editable: true },
      { headerName: "Type", field: "type", maxWidth: 110 },
      {
        headerName: "Amount",
        field: "amount",
        maxWidth: 140,
        editable: true,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
        valueParser: (params) =>
          Number(String(params.newValue).replace(/[^0-9.-]+/g, "")) || 0,
      },
      { headerName: "Category", field: "category", flex: 1.1 },
      { headerName: "Merchant", field: "merchant", flex: 1.1, editable: true },
      { headerName: "Account", field: "account", flex: 1 },
      { headerName: "Payment", field: "payment", flex: 1 },
      {
        headerName: "Notes",
        field: "notes",
        flex: 1.4,
        cellClass: "datatrix-cell-muted",
        editable: true,
      },
      {
        headerName: "Tags",
        field: "tags",
        flex: 1.1,
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Status",
        field: "status",
        maxWidth: 110,
      },
    ],
    [],
  );

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center" wrap="wrap">
        <Title order={5}>Preview</Title>
        <Group gap="xs">
          <Badge variant="light" color="blue">
            {parsedRowCount} rows
          </Badge>
          <Badge variant="light" color="green">
            {validRows.length} valid
          </Badge>
          <Badge variant="light" color={invalidRows.length ? "red" : "gray"}>
            {invalidRows.length} invalid
          </Badge>
        </Group>
      </Group>
      {parsedRowCount === 0 ? (
        <Text size="sm" c="dimmed">
          No CSV data loaded yet.
        </Text>
      ) : (
        <DatatrixTable
          rows={previewRows}
          columns={previewColumns}
          height={320}
          emptyLabel="No valid rows to preview."
          getRowId={(row) => row.id}
          onCellValueChanged={(event) => {
            if (event.data && event.colDef.field) {
              onRowEdit(
                Number(event.data.id),
                event.colDef.field,
                event.newValue,
              );
            }
          }}
        />
      )}
      {invalidRows.length > 0 ? (
        <Alert color="red" variant="light">
          <Stack gap="xs">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" fw={600}>
                Invalid rows ({invalidRows.length})
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => onExportErrors("csv")}
                >
                  Export CSV
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => onExportErrors("json")}
                >
                  Export JSON
                </Button>
              </Group>
            </Group>
            <Text size="xs" c="dimmed">
              Exports include row numbers, errors, and original columns.
            </Text>
            <List size="sm" spacing="xs">
              {invalidRows.slice(0, 5).map((item) => (
                <List.Item key={item.rowNumber}>
                  Row {item.rowNumber}: {item.errors.join("; ")}
                </List.Item>
              ))}
            </List>
          </Stack>
        </Alert>
      ) : null}
      {warnings.length > 0 ? (
        <Alert color="yellow" variant="light">
          <Text size="sm" fw={600}>
            Warnings
          </Text>
          <List size="sm" mt="xs" spacing="xs">
            {warnings.slice(0, 5).map((item) => (
              <List.Item key={item}>{item}</List.Item>
            ))}
          </List>
        </Alert>
      ) : null}
      {importError ? (
        <Alert color="red" variant="light">
          {importError}
        </Alert>
      ) : null}
      {importResult ? (
        <Alert
          color={importResult.failed > 0 ? "yellow" : "green"}
          variant="light"
        >
          <Stack gap="xs">
            <Text size="sm">
              Imported {importResult.success} transactions,{" "}
              {importResult.failed} failed.
            </Text>
            {importResult.errors.length > 0 ? (
              <List size="sm" spacing="xs">
                {importResult.errors.map((item) => (
                  <List.Item key={item}>{item}</List.Item>
                ))}
              </List>
            ) : null}
            {showRetryHint ? (
              <Text size="xs" c="dimmed">
                Export invalid rows to enable retry.
              </Text>
            ) : null}
            {canRetryFailedRows ? (
              <Group justify="flex-end">
                <Button
                  size="xs"
                  variant="light"
                  onClick={onRetryFailedRows}
                  disabled={Boolean(importProgress)}
                >
                  Retry failed rows
                </Button>
              </Group>
            ) : null}
          </Stack>
        </Alert>
      ) : null}
      {importProgress ? (
        <Text size="xs" c="dimmed">
          Importing {importProgress.completed} of {importProgress.total}...
        </Text>
      ) : null}
    </Stack>
  );
};
