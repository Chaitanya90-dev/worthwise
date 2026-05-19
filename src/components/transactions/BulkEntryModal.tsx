import {
  ActionIcon,
  Alert,
  Autocomplete,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  useAddTransactionMutation,
  useAddQuickTemplateMutation,
  useDeleteQuickTemplateMutation,
  useGetQuickTemplatesQuery,
  useGetRulesQuery,
  useGetTransactionsByRangeQuery,
  useUpdateQuickTemplateMutation,
} from "../../features/api/apiSlice";
import { useAppSelector } from "../../app/hooks";
import { buildFrequentMerchantOptions } from "../../lib/merchant";
import {
  buildBulkEntryRows,
  createBulkEntryRow,
  getNextBulkEntryDate,
  resolveBulkEntryRow,
  type BulkEntryDefaults,
  type BulkEntryRowDraft,
} from "../../lib/bulkEntry";
import {
  loadTransactionDefaults,
  saveTransactionDefaults,
} from "../../lib/preferences";
import type {
  Account,
  Category,
  PaymentMethod,
  QuickTemplate,
} from "../../types/finance";

type BulkEntryModalProps = {
  opened: boolean;
  onClose: () => void;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  readOnly?: boolean;
};

type GridNavField = "date" | "amount" | "merchant" | "notes";

const GRID_NAV_FIELDS: GridNavField[] = ["date", "amount", "merchant", "notes"];

const isCardPaymentMethod = (method: PaymentMethod) => {
  const normalized = method.name.toLowerCase();
  return normalized.includes("card") || normalized.includes("pos");
};

const hasIncompatibleCardPayment = ({
  accountId,
  paymentMethodId,
  accounts,
  paymentMethods,
}: {
  accountId: string;
  paymentMethodId: string;
  accounts: Account[];
  paymentMethods: PaymentMethod[];
}) => {
  if (!accountId || !paymentMethodId) {
    return false;
  }
  const selectedAccount =
    accounts.find((account) => account.id === accountId) ?? null;
  if (selectedAccount?.type !== "card") {
    return false;
  }
  const selectedPaymentMethod =
    paymentMethods.find(
      (paymentMethod) => paymentMethod.id === paymentMethodId,
    ) ?? null;
  return selectedPaymentMethod
    ? !isCardPaymentMethod(selectedPaymentMethod)
    : false;
};

const buildInitialDefaults = (
  savedDefaults: ReturnType<typeof loadTransactionDefaults>,
  accounts: Account[],
): BulkEntryDefaults => ({
  type: "expense",
  date: dayjs().format("YYYY-MM-DD"),
  autoIncrementDate: true,
  category_id: savedDefaults?.category_id ?? "",
  payment_method_id: savedDefaults?.payment_method_id ?? "",
  account_id: savedDefaults?.account_id ?? accounts[0]?.id ?? "",
});

const isRowDraftEmpty = (row: BulkEntryRowDraft) =>
  !row.amount.trim() &&
  !row.merchant.trim() &&
  !row.notes.trim() &&
  !row.category_id &&
  !row.payment_method_id &&
  !row.account_id;

const toTemplateRowOverrides = (template: QuickTemplate) => ({
  amount: template.amount === null ? "" : String(template.amount),
  merchant: template.merchant ?? "",
  notes: template.notes ?? "",
  category_id: template.category_id ?? "",
  payment_method_id: template.payment_method_id ?? "",
  account_id: template.account_id ?? "",
});

export const BulkEntryModal = ({
  opened,
  onClose,
  categories,
  paymentMethods,
  accounts,
  readOnly = false,
}: BulkEntryModalProps) => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const [addTransaction] = useAddTransactionMutation();
  const { data: quickTemplates = [] } = useGetQuickTemplatesQuery(undefined, {
    skip: !opened,
    refetchOnMountOrArgChange: true,
  });
  const [addQuickTemplate, { isLoading: isAddingQuickTemplate }] =
    useAddQuickTemplateMutation();
  const [updateQuickTemplate, { isLoading: isUpdatingQuickTemplate }] =
    useUpdateQuickTemplateMutation();
  const [deleteQuickTemplate, { isLoading: isDeletingQuickTemplate }] =
    useDeleteQuickTemplateMutation();
  const { data: rules = [] } = useGetRulesQuery();
  const merchantRangeStart = useMemo(
    () => dayjs().subtract(18, "month").startOf("month").format("YYYY-MM-DD"),
    [],
  );
  const merchantRangeEnd = useMemo(
    () => dayjs().endOf("day").format("YYYY-MM-DD"),
    [],
  );
  const { data: merchantHistory = [] } = useGetTransactionsByRangeQuery(
    { start: merchantRangeStart, end: merchantRangeEnd },
    { skip: !opened, refetchOnMountOrArgChange: true },
  );

  const [defaults, setDefaults] = useState<BulkEntryDefaults>(() =>
    buildInitialDefaults(loadTransactionDefaults(userId), accounts),
  );
  const [rows, setRows] = useState<BulkEntryRowDraft[]>(() =>
    buildBulkEntryRows(dayjs().format("YYYY-MM-DD")),
  );
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const wasOpenedRef = useRef(false);
  const gridInputRefs = useRef<
    Record<string, Partial<Record<GridNavField, HTMLInputElement | null>>>
  >({});
  const defaultCardPaymentId = useMemo(
    () => paymentMethods.find((method) => isCardPaymentMethod(method))?.id ?? "",
    [paymentMethods],
  );

  useEffect(() => {
    if (!opened) {
      wasOpenedRef.current = false;
      return;
    }
    if (wasOpenedRef.current) {
      return;
    }
    wasOpenedRef.current = true;
    const initial = buildInitialDefaults(loadTransactionDefaults(userId), accounts);
    setDefaults(initial);
    setRows(buildBulkEntryRows(initial.date));
    setActiveRowId(null);
    setTemplateNameInput("");
    setEditingTemplateId(null);
    setError(null);
    setSuccess(null);
  }, [opened, userId, accounts]);

  useEffect(() => {
    if (!opened || defaults.account_id || !accounts[0]?.id) {
      return;
    }
    setDefaults((prev) => ({ ...prev, account_id: accounts[0]?.id ?? "" }));
  }, [opened, defaults.account_id, accounts]);

  useEffect(() => {
    if (!opened || !defaults.account_id || !defaults.payment_method_id) {
      return;
    }
    if (
      hasIncompatibleCardPayment({
        accountId: defaults.account_id,
        paymentMethodId: defaults.payment_method_id,
        accounts,
        paymentMethods,
      })
    ) {
      setDefaults((prev) => ({
        ...prev,
        payment_method_id: defaultCardPaymentId,
      }));
    }
  }, [
    opened,
    defaults.account_id,
    defaults.payment_method_id,
    accounts,
    paymentMethods,
    defaultCardPaymentId,
  ]);

  useEffect(() => {
    if (!opened) {
      return;
    }
    const selectedCategory = categories.find(
      (category) => category.id === defaults.category_id,
    );
    if (selectedCategory && selectedCategory.type !== defaults.type) {
      setDefaults((prev) => ({ ...prev, category_id: "" }));
    }
  }, [opened, defaults.type, defaults.category_id, categories]);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (!row.category_id) {
          return row;
        }
        const selectedCategory = categories.find(
          (category) => category.id === row.category_id,
        );
        if (!selectedCategory || selectedCategory.type === defaults.type) {
          return row;
        }
        changed = true;
        return { ...row, category_id: "" };
      });
      return changed ? next : prev;
    });
  }, [opened, defaults.type, categories]);

  useEffect(() => {
    const activeIds = new Set(rows.map((row) => row.id));
    Object.keys(gridInputRefs.current).forEach((rowId) => {
      if (!activeIds.has(rowId)) {
        delete gridInputRefs.current[rowId];
      }
    });
  }, [rows]);

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.type === defaults.type)
        .map((category) => ({
          value: category.id,
          label: category.name,
        })),
    [categories, defaults.type],
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === defaults.account_id) ?? null,
    [accounts, defaults.account_id],
  );

  const paymentOptions = useMemo(() => {
    const isCardAccount = selectedAccount?.type === "card";
    return paymentMethods
      .filter((method) => !isCardAccount || isCardPaymentMethod(method))
      .map((method) => ({
        value: method.id,
        label: method.name,
      }));
  }, [paymentMethods, selectedAccount]);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${account.type === "card" ? "Credit card" : account.type}`,
      })),
    [accounts],
  );

  const merchantOptions = useMemo(
    () => buildFrequentMerchantOptions(merchantHistory, 200),
    [merchantHistory],
  );

  const getPaymentOptionsForAccount = (accountId: string) => {
    const selectedRowAccount =
      accounts.find((account) => account.id === accountId) ?? null;
    const isCardAccount = selectedRowAccount?.type === "card";
    return paymentMethods
      .filter((method) => !isCardAccount || isCardPaymentMethod(method))
      .map((method) => ({
        value: method.id,
        label: method.name,
      }));
  };

  const resolvedRows = useMemo(
    () =>
      rows.map((row) =>
        resolveBulkEntryRow({
          row,
          defaults,
          categories,
          paymentMethods,
          accounts,
          rules,
        }),
      ),
    [rows, defaults, categories, paymentMethods, accounts, rules],
  );

  const actionableRows = useMemo(
    () => resolvedRows.filter((row) => !row.isEmpty),
    [resolvedRows],
  );

  const invalidRows = useMemo(
    () => actionableRows.filter((row) => row.errors.length > 0),
    [actionableRows],
  );

  const templatesForType = useMemo(
    () =>
      quickTemplates.filter(
        (template) => template.transaction_type === defaults.type,
      ),
    [quickTemplates, defaults.type],
  );

  const editingTemplate = useMemo(
    () =>
      editingTemplateId
        ? templatesForType.find((template) => template.id === editingTemplateId) ??
          null
        : null,
    [editingTemplateId, templatesForType],
  );

  useEffect(() => {
    if (!editingTemplateId || editingTemplate) {
      return;
    }
    setEditingTemplateId(null);
    setTemplateNameInput("");
  }, [editingTemplateId, editingTemplate]);

  const handleRowChange = (
    rowId: string,
    key: keyof Omit<BulkEntryRowDraft, "id">,
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        if (key !== "account_id") {
          return { ...row, [key]: value };
        }
        if (!value || !row.payment_method_id) {
          return { ...row, account_id: value };
        }
        if (
          hasIncompatibleCardPayment({
            accountId: value,
            paymentMethodId: row.payment_method_id,
            accounts,
            paymentMethods,
          })
        ) {
          return {
            ...row,
            account_id: value,
            payment_method_id: "",
          };
        }
        return { ...row, account_id: value };
      }),
    );
    setError(null);
    setSuccess(null);
  };

  const handleAddRow = (afterRowId?: string) => {
    let createdRowId: string | null = null;
    setRows((prev) => {
      const anchorIndex = afterRowId
        ? prev.findIndex((row) => row.id === afterRowId)
        : prev.length - 1;
      const safeIndex = anchorIndex >= 0 ? anchorIndex : prev.length - 1;
      const anchorDate = prev[safeIndex]?.date ?? defaults.date;
      const nextRow = createBulkEntryRow(
        getNextBulkEntryDate({
          baseDate: anchorDate,
          autoIncrementDate: defaults.autoIncrementDate,
        }),
      );
      createdRowId = nextRow.id;
      const next = [...prev];
      next.splice(safeIndex + 1, 0, nextRow);
      return next;
    });
    setError(null);
    setSuccess(null);
    return createdRowId;
  };

  const handleDuplicateRow = (rowId?: string | null) => {
    if (!rowId) {
      handleAddRow();
      return;
    }
    setRows((prev) => {
      const sourceIndex = prev.findIndex((row) => row.id === rowId);
      if (sourceIndex === -1) {
        return prev;
      }
      const source = prev[sourceIndex];
      const nextRow = createBulkEntryRow(source.date, {
        amount: source.amount,
        merchant: source.merchant,
        notes: source.notes,
        category_id: source.category_id,
        payment_method_id: source.payment_method_id,
        account_id: source.account_id,
      });
      const next = [...prev];
      next.splice(sourceIndex + 1, 0, nextRow);
      return next;
    });
    setError(null);
    setSuccess(null);
  };

  const handleDeleteRow = (rowId: string) => {
    setRows((prev) => {
      if (prev.length === 1) {
        return [createBulkEntryRow(defaults.date)];
      }
      return prev.filter((row) => row.id !== rowId);
    });
    if (activeRowId === rowId) {
      setActiveRowId(null);
    }
    setError(null);
    setSuccess(null);
  };

  const handleClearEmptyRows = () => {
    setRows((prev) => {
      const next = prev.filter((row) => !isRowDraftEmpty(row));
      return next.length > 0 ? next : [createBulkEntryRow(defaults.date)];
    });
    setError(null);
    setSuccess(null);
  };

  const bindGridInputRef =
    (rowId: string, field: GridNavField) => (node: HTMLInputElement | null) => {
      if (!gridInputRefs.current[rowId]) {
        gridInputRefs.current[rowId] = {};
      }
      gridInputRefs.current[rowId][field] = node;
    };

  const focusGridInput = (rowId: string, field: GridNavField) => {
    const focusTarget = () => {
      const input = gridInputRefs.current[rowId]?.[field];
      if (input) {
        input.focus();
        setActiveRowId(rowId);
      }
    };
    if (typeof window === "undefined") {
      setTimeout(focusTarget, 0);
      return;
    }
    window.requestAnimationFrame(focusTarget);
  };

  const getAdjacentGridInput = ({
    rowId,
    field,
    reverse,
  }: {
    rowId: string;
    field: GridNavField;
    reverse: boolean;
  }) => {
    const rowIndex = rows.findIndex((row) => row.id === rowId);
    const fieldIndex = GRID_NAV_FIELDS.findIndex((key) => key === field);
    if (rowIndex < 0 || fieldIndex < 0) {
      return null;
    }

    if (reverse) {
      if (fieldIndex > 0) {
        return {
          rowId,
          field: GRID_NAV_FIELDS[fieldIndex - 1],
        };
      }
      if (rowIndex > 0) {
        return {
          rowId: rows[rowIndex - 1].id,
          field: GRID_NAV_FIELDS[GRID_NAV_FIELDS.length - 1],
        };
      }
      return null;
    }

    if (fieldIndex < GRID_NAV_FIELDS.length - 1) {
      return {
        rowId,
        field: GRID_NAV_FIELDS[fieldIndex + 1],
      };
    }
    if (rowIndex < rows.length - 1) {
      return {
        rowId: rows[rowIndex + 1].id,
        field: GRID_NAV_FIELDS[0],
      };
    }
    return null;
  };

  const handleRowShortcut = (
    event: KeyboardEvent<HTMLElement>,
    rowId: string,
  ) => {
    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
      return false;
    }
    event.preventDefault();
    if (event.shiftKey) {
      handleDuplicateRow(rowId);
      return true;
    }
    handleAddRow(rowId);
    return true;
  };

  const handleGridKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    rowId: string,
    field: GridNavField,
  ) => {
    if (handleRowShortcut(event, rowId)) {
      return;
    }

    if (event.key !== "Enter" && event.key !== "Tab") {
      return;
    }

    const isComboboxOpen =
      event.currentTarget.getAttribute("aria-expanded") === "true";
    if (event.key === "Enter" && isComboboxOpen) {
      return;
    }

    event.preventDefault();
    const reverse = event.shiftKey;
    const adjacent = getAdjacentGridInput({ rowId, field, reverse });
    if (adjacent) {
      focusGridInput(adjacent.rowId, adjacent.field);
      return;
    }
    if (reverse) {
      return;
    }

    const nextRowId = handleAddRow(rowId);
    if (nextRowId) {
      focusGridInput(nextRowId, GRID_NAV_FIELDS[0]);
    }
  };

  const getTemplateSourceRow = () => {
    if (activeRowId) {
      const activeResolved = resolvedRows.find((row) => row.id === activeRowId);
      if (activeResolved && !activeResolved.isEmpty) {
        return activeResolved;
      }
    }
    return actionableRows[0] ?? null;
  };

  const buildTemplatePayload = (
    source: ReturnType<typeof getTemplateSourceRow>,
    name: string,
  ): Omit<QuickTemplate, "id"> | null => {
    if (!source) {
      return null;
    }
    return {
      name,
      transaction_type: defaults.type,
      amount: source.amountValue,
      merchant: source.merchant,
      notes: source.notes,
      category_id: source.category_id,
      payment_method_id: source.payment_method_id,
      account_id: source.account_id,
    };
  };

  const resolveTemplateName = (source: ReturnType<typeof getTemplateSourceRow>) => {
    const provided = templateNameInput.trim();
    if (provided) {
      return provided;
    }
    if (source?.merchant) {
      return source.merchant.slice(0, 60);
    }
    if (source?.notes) {
      return source.notes.slice(0, 60);
    }
    return `Template ${templatesForType.length + 1}`;
  };

  const handleStartTemplateEdit = (template: QuickTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateNameInput(template.name);
    setError(null);
    setSuccess(null);
  };

  const handleCancelTemplateEdit = () => {
    setEditingTemplateId(null);
    setTemplateNameInput("");
    setError(null);
    setSuccess(null);
  };

  const handleSaveTemplate = async () => {
    if (readOnly) {
      setError("Demo mode is read-only. You can browse but not save changes.");
      return;
    }

    const source = getTemplateSourceRow();
    if (!source) {
      setError("Fill at least one row before creating a template.");
      return;
    }

    const hasTemplateData =
      source.amountValue !== null ||
      Boolean(source.merchant) ||
      Boolean(source.notes) ||
      Boolean(source.category_id) ||
      Boolean(source.account_id) ||
      Boolean(source.payment_method_id);
    if (!hasTemplateData) {
      setError("Template needs at least one filled field from a row.");
      return;
    }

    const templateName = resolveTemplateName(source);
    const payload = buildTemplatePayload(source, templateName);
    if (!payload) {
      setError("Unable to build template from the selected row.");
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      if (editingTemplateId && editingTemplate) {
        await updateQuickTemplate({
          id: editingTemplateId,
          ...payload,
        }).unwrap();
        setSuccess(`Updated template "${templateName}".`);
      } else {
        await addQuickTemplate(payload).unwrap();
        setSuccess(`Saved template "${templateName}".`);
      }
      setEditingTemplateId(null);
      setTemplateNameInput("");
    } catch {
      setError(
        editingTemplateId
          ? "Unable to update template."
          : "Unable to save template.",
      );
    }
  };

  const handleDeleteTemplate = async (template: QuickTemplate) => {
    if (readOnly) {
      setError("Demo mode is read-only. You can browse but not save changes.");
      return;
    }
    const shouldDelete =
      typeof window === "undefined"
        ? true
        : window.confirm(`Delete template "${template.name}"?`);
    if (!shouldDelete) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await deleteQuickTemplate({ id: template.id }).unwrap();
      if (editingTemplateId === template.id) {
        setEditingTemplateId(null);
        setTemplateNameInput("");
      }
      setSuccess(`Deleted template "${template.name}".`);
    } catch {
      setError("Unable to delete template.");
    }
  };

  const handleApplyTemplate = (template: QuickTemplate) => {
    const patch = toTemplateRowOverrides(template);
    if (
      hasIncompatibleCardPayment({
        accountId: patch.account_id,
        paymentMethodId: patch.payment_method_id,
        accounts,
        paymentMethods,
      })
    ) {
      patch.payment_method_id = "";
    }

    let nextActiveId: string | null = null;
    let appliedRowNumber = 0;
    setRows((prev) => {
      const activeIndex = activeRowId
        ? prev.findIndex((row) => row.id === activeRowId)
        : -1;
      const emptyIndex = prev.findIndex((row) => isRowDraftEmpty(row));
      const targetIndex =
        activeIndex >= 0 ? activeIndex : emptyIndex >= 0 ? emptyIndex : -1;

      if (targetIndex >= 0) {
        const target = prev[targetIndex];
        const updatedRow = {
          ...target,
          ...patch,
        };
        const next = [...prev];
        next[targetIndex] = updatedRow;
        nextActiveId = updatedRow.id;
        appliedRowNumber = targetIndex + 1;
        return next;
      }

      const anchorDate = prev[prev.length - 1]?.date ?? defaults.date;
      const nextRow = createBulkEntryRow(
        getNextBulkEntryDate({
          baseDate: anchorDate,
          autoIncrementDate: defaults.autoIncrementDate,
        }),
        patch,
      );
      nextActiveId = nextRow.id;
      appliedRowNumber = prev.length + 1;
      return [...prev, nextRow];
    });
    setActiveRowId(nextActiveId);
    setError(null);
    setSuccess(`Applied template "${template.name}" to row ${appliedRowNumber}.`);
  };

  const handleSave = async () => {
    if (readOnly) {
      setError("Demo mode is read-only. You can browse but not save changes.");
      return;
    }
    setError(null);
    setSuccess(null);

    if (actionableRows.length === 0) {
      setError("Add at least one row before saving.");
      return;
    }

    if (invalidRows.length > 0) {
      const firstInvalid = resolvedRows.findIndex(
        (row) => row.id === invalidRows[0]?.id,
      );
      setError(
        `Fix row ${firstInvalid + 1}: ${invalidRows[0]?.errors[0] ?? "Invalid entry."}`,
      );
      return;
    }

    setIsSaving(true);
    let saved = 0;
    try {
      for (const row of actionableRows) {
        await addTransaction({
          type: defaults.type,
          date: row.date,
          amount: row.amountValue ?? 0,
          category_id: row.category_id,
          payment_method_id: row.payment_method_id,
          account_id: row.account_id,
          merchant: row.merchant,
          notes: row.notes,
          tags: row.tags,
          is_transfer: false,
          is_recurring: false,
          is_reimbursement: false,
          is_shared: false,
        }).unwrap();
        saved += 1;
      }

      saveTransactionDefaults(userId, {
        account_id: defaults.account_id,
        payment_method_id: defaults.payment_method_id,
        category_id: defaults.category_id,
      });

      const nextDate = defaults.autoIncrementDate
        ? getNextBulkEntryDate({
            baseDate: actionableRows[actionableRows.length - 1]?.date ?? defaults.date,
            autoIncrementDate: true,
          })
        : defaults.date;

      setDefaults((prev) => ({ ...prev, date: nextDate }));
      setRows(buildBulkEntryRows(nextDate));
      setActiveRowId(null);
      setSuccess(
        `Saved ${saved} transaction${saved === 1 ? "" : "s"}.`,
      );
    } catch {
      setError(
        saved > 0
          ? `Saved ${saved} transaction${saved === 1 ? "" : "s"} before a failure. Review the remaining rows and try again.`
          : "Unable to save these transactions.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Bulk entry"
      size="calc(100vw - 6rem)"
      centered
    >
      <Stack gap="md">
        <Alert variant="light" color="blue" title="Fast entry">
          Tab or Enter moves across Date, Amount, Merchant, and Notes. Reaching
          the end auto-creates the next row. Use Ctrl/Cmd+Enter to add a row and
          Shift+Ctrl/Cmd+Enter to duplicate the current row. Shared splits,
          transfers, and reimbursements still use the full transaction form.
        </Alert>

        <Paper withBorder radius="md" p="sm">
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" fw={600}>
                Quick templates
              </Text>
              <Text size="xs" c="dimmed">
                Click a template to apply it to the active row or first empty row.
              </Text>
            </Group>

            {templatesForType.length === 0 ? (
              <Text size="xs" c="dimmed">
                No templates yet for {defaults.type}. Save a filled row to create one.
              </Text>
            ) : (
              <Group gap="xs" wrap="wrap">
                {templatesForType.map((template) => (
                  <Group key={template.id} gap={4} wrap="nowrap">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => handleApplyTemplate(template)}
                      disabled={readOnly}
                    >
                      {template.name}
                    </Button>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      aria-label={`Edit template ${template.name}`}
                      onClick={() => handleStartTemplateEdit(template)}
                      disabled={
                        readOnly || isAddingQuickTemplate || isUpdatingQuickTemplate
                      }
                    >
                      <Pencil size={14} strokeWidth={2} />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      aria-label={`Delete template ${template.name}`}
                      onClick={() => handleDeleteTemplate(template)}
                      disabled={readOnly || isDeletingQuickTemplate}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </ActionIcon>
                  </Group>
                ))}
              </Group>
            )}

            <Group align="end" gap="sm" wrap="wrap">
              <TextInput
                label={editingTemplate ? "Edit template name" : "Template name"}
                value={templateNameInput}
                onChange={(event) => setTemplateNameInput(event.target.value)}
                placeholder="Auto from merchant if empty"
                size="xs"
                style={{ minWidth: 260 }}
              />
              <Button
                size="xs"
                variant="light"
                onClick={handleSaveTemplate}
                loading={isAddingQuickTemplate || isUpdatingQuickTemplate}
                disabled={readOnly}
              >
                {editingTemplate
                  ? "Update from active row"
                  : "Save active row as template"}
              </Button>
              {editingTemplate ? (
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={handleCancelTemplateEdit}
                >
                  Cancel edit
                </Button>
              ) : null}
            </Group>
            <Text size="xs" c="dimmed">
              Saving or updating a template uses the active row if selected, otherwise
              the first filled row.
            </Text>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="sm">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, md: 2, xl: 6 }} spacing="sm">
              <SegmentedControl
                data={[
                  { value: "expense", label: "Expense" },
                  { value: "income", label: "Income" },
                ]}
                value={defaults.type}
                onChange={(value) =>
                  setDefaults((prev) => ({
                    ...prev,
                    type: value as "expense" | "income",
                  }))
                }
                fullWidth
              />
              <DateInput
                label="Base date"
                value={dayjs(defaults.date).toDate()}
                onChange={(value) =>
                  setDefaults((prev) => ({
                    ...prev,
                    date: value
                      ? dayjs(value).format("YYYY-MM-DD")
                      : dayjs().format("YYYY-MM-DD"),
                  }))
                }
              />
              <Switch
                checked={defaults.autoIncrementDate}
                onChange={(event) =>
                  setDefaults((prev) => ({
                    ...prev,
                    autoIncrementDate: event.currentTarget.checked,
                  }))
                }
                label="Auto-increment date"
                mt="md"
              />
              <Select
                label="Default account"
                data={accountOptions}
                value={defaults.account_id || null}
                onChange={(value) =>
                  setDefaults((prev) => ({
                    ...prev,
                    account_id: value ?? "",
                    payment_method_id:
                      value &&
                      hasIncompatibleCardPayment({
                        accountId: value,
                        paymentMethodId: prev.payment_method_id,
                        accounts,
                        paymentMethods,
                      })
                        ? defaultCardPaymentId
                        : prev.payment_method_id,
                  }))
                }
                searchable
                clearable
                placeholder="Choose"
              />
              <Select
                label="Default payment"
                data={paymentOptions}
                value={defaults.payment_method_id || null}
                onChange={(value) =>
                  setDefaults((prev) => ({
                    ...prev,
                    payment_method_id: value ?? "",
                  }))
                }
                searchable
                clearable
                placeholder="Choose"
              />
              <Select
                label="Fallback category"
                data={categoryOptions}
                value={defaults.category_id || null}
                onChange={(value) =>
                  setDefaults((prev) => ({
                    ...prev,
                    category_id: value ?? "",
                  }))
                }
                searchable
                clearable
                placeholder="Choose"
              />
            </SimpleGrid>
            <Text size="xs" c="dimmed">
              Each row starts with these defaults. Row-level category, account,
              and payment overrides are optional, and a row category override
              beats rule autofill.
            </Text>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="sm">
          <Group justify="space-between" align="center" mb="sm" wrap="wrap">
            <Text size="sm" c="dimmed">
              {actionableRows.length} row{actionableRows.length === 1 ? "" : "s"} ready
              {invalidRows.length > 0
                ? ` · ${invalidRows.length} need fixes`
                : ""}
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<Plus size={14} strokeWidth={2} />}
                onClick={() => handleAddRow(activeRowId ?? undefined)}
              >
                Add row
              </Button>
              <Button
                size="xs"
                variant="light"
                leftSection={<Copy size={14} strokeWidth={2} />}
                onClick={() => handleDuplicateRow(activeRowId)}
              >
                Duplicate row
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={handleClearEmptyRows}
              >
                Clear empty rows
              </Button>
            </Group>
          </Group>

          <ScrollArea>
            <Table
              horizontalSpacing="sm"
              verticalSpacing="sm"
              striped
              highlightOnHover
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={64}>#</Table.Th>
                  <Table.Th w={160}>Date</Table.Th>
                  <Table.Th w={140}>Amount</Table.Th>
                  <Table.Th miw={340}>Merchant / Notes</Table.Th>
                  <Table.Th miw={320}>Autofill / Overrides</Table.Th>
                  <Table.Th w={96}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row, index) => {
                  const resolved = resolvedRows[index];
                  const rowError =
                    !resolved.isEmpty && resolved.errors.length > 0
                      ? resolved.errors[0]
                      : null;
                  const rowPaymentOptions = getPaymentOptionsForAccount(
                    row.account_id || defaults.account_id || "",
                  );
                  const autofillError =
                    rowError &&
                    !rowError.includes("amount") &&
                    !rowError.includes("merchant") &&
                    !rowError.includes("notes")
                      ? rowError
                      : null;

                  return (
                    <Table.Tr key={row.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {index + 1}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <DateInput
                          ref={bindGridInputRef(row.id, "date")}
                          value={row.date ? dayjs(row.date).toDate() : null}
                          onChange={(value) =>
                            handleRowChange(
                              row.id,
                              "date",
                              value
                                ? dayjs(value).format("YYYY-MM-DD")
                                : "",
                            )
                          }
                          onFocus={() => setActiveRowId(row.id)}
                          onKeyDown={(event) =>
                            handleGridKeyDown(event, row.id, "date")
                          }
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          ref={bindGridInputRef(row.id, "amount")}
                          value={row.amount}
                          onChange={(event) =>
                            handleRowChange(row.id, "amount", event.target.value)
                          }
                          onFocus={() => setActiveRowId(row.id)}
                          onKeyDown={(event) =>
                            handleGridKeyDown(event, row.id, "amount")
                          }
                          size="xs"
                          placeholder="0"
                          type="number"
                          min="0"
                          step="0.01"
                          error={rowError?.includes("amount") ? rowError : undefined}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={6}>
                          <Autocomplete
                            ref={bindGridInputRef(row.id, "merchant")}
                            value={row.merchant}
                            onChange={(value) =>
                              handleRowChange(row.id, "merchant", value)
                            }
                            onFocus={() => setActiveRowId(row.id)}
                            onKeyDown={(event) =>
                              handleGridKeyDown(event, row.id, "merchant")
                            }
                            data={merchantOptions}
                            size="xs"
                            placeholder="Merchant"
                            error={
                              rowError?.includes("merchant") ||
                              rowError?.includes("notes")
                                ? rowError
                                : undefined
                            }
                          />
                          <TextInput
                            ref={bindGridInputRef(row.id, "notes")}
                            value={row.notes}
                            onChange={(event) =>
                              handleRowChange(row.id, "notes", event.target.value)
                            }
                            onFocus={() => setActiveRowId(row.id)}
                            onKeyDown={(event) =>
                              handleGridKeyDown(event, row.id, "notes")
                            }
                            size="xs"
                            placeholder="Notes"
                          />
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={6}>
                          <Group gap={6} wrap="wrap">
                            <Badge size="xs" variant="light" color="orange">
                              {resolved.categoryLabel}
                            </Badge>
                            <Badge size="xs" variant="light" color="blue">
                              {resolved.accountLabel}
                            </Badge>
                            <Badge size="xs" variant="light" color="grape">
                              {resolved.paymentLabel}
                            </Badge>
                          </Group>
                          <Select
                            value={row.category_id || null}
                            onChange={(value) =>
                              handleRowChange(row.id, "category_id", value ?? "")
                            }
                            onFocus={() => setActiveRowId(row.id)}
                            data={categoryOptions}
                            size="xs"
                            searchable
                            clearable
                            placeholder="Override category"
                          />
                          <Select
                            value={row.account_id || null}
                            onChange={(value) =>
                              handleRowChange(row.id, "account_id", value ?? "")
                            }
                            onFocus={() => setActiveRowId(row.id)}
                            data={accountOptions}
                            size="xs"
                            searchable
                            clearable
                            placeholder="Override account"
                          />
                          <Select
                            value={row.payment_method_id || null}
                            onChange={(value) =>
                              handleRowChange(
                                row.id,
                                "payment_method_id",
                                value ?? "",
                              )
                            }
                            onFocus={() => setActiveRowId(row.id)}
                            data={rowPaymentOptions}
                            size="xs"
                            searchable
                            clearable
                            placeholder="Override payment"
                          />
                          {resolved.tags.length > 0 ? (
                            <Text size="xs" c="dimmed">
                              Tags: {resolved.tags.join(", ")}
                            </Text>
                          ) : (
                            <Text size="xs" c="dimmed">
                              No rule tags
                            </Text>
                          )}
                          {autofillError ? (
                            <Text size="xs" c="red">
                              {autofillError}
                            </Text>
                          ) : null}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            aria-label="Duplicate row"
                            onClick={() => handleDuplicateRow(row.id)}
                          >
                            <Copy size={16} strokeWidth={2} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="Delete row"
                            onClick={() => handleDeleteRow(row.id)}
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>

        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert color="green" variant="light">
            {success}
          </Alert>
        ) : null}

        <Group justify="space-between" wrap="wrap">
          <Text size="xs" c="dimmed">
            For transfers, reimbursements, and shared expenses, use the full
            transaction form.
          </Text>
          <Group gap="sm">
            <Button variant="subtle" color="gray" onClick={onClose}>
              Close
            </Button>
            <Button
              color="green"
              loading={isSaving}
              onClick={handleSave}
              disabled={readOnly}
            >
              {actionableRows.length > 0
                ? `Save ${actionableRows.length} transaction${actionableRows.length === 1 ? "" : "s"}`
                : "Save transactions"}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};
