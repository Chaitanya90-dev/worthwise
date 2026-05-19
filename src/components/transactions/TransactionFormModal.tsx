import {
  Alert,
  Accordion,
  Autocomplete,
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import dayjs from "dayjs";
import {
  useAddTransactionMutation,
  useDeleteTransactionMutation,
  useGetRulesQuery,
  useGetSharedExpensesQuery,
  useGetTransactionsByRangeQuery,
  useUpdateTransactionMutation,
} from "../../features/api/apiSlice";
import { useAppSelector } from "../../app/hooks";
import { formatINR } from "../../lib/format";
import { buildFrequentMerchantOptions } from "../../lib/merchant";
import { applyRulesToTransaction } from "../../lib/rules";
import {
  loadTransactionDefaults,
  saveTransactionDefaults,
  type TransactionDefaults,
} from "../../lib/preferences";
import {
  SharedSplitEditor,
  type SharedSplitDraft,
} from "../shared/SharedSplitEditor";
import type {
  Account,
  Category,
  PaymentMethod,
  Transaction,
} from "../../types/finance";
import { getTransactionCounterpartyName } from "../../lib/transactions";

type TransactionFormModalProps = {
  opened: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  readOnly?: boolean;
};

const hasQueryError = (value: unknown) => Boolean(value);

const buildInitialForm = (
  transaction?: Transaction | null,
  defaults?: TransactionDefaults | null,
) => ({
  type: transaction?.type ?? "expense",
  date: transaction?.date ?? dayjs().format("YYYY-MM-DD"),
  amount: transaction ? String(transaction.amount) : "",
  category_id: transaction?.category_id ?? defaults?.category_id ?? "",
  payment_method_id:
    transaction?.payment_method_id ?? defaults?.payment_method_id ?? "",
  account_id: transaction?.account_id ?? defaults?.account_id ?? "",
  merchant: transaction ? getTransactionCounterpartyName(transaction) : "",
  notes: transaction?.notes ?? "",
  tags: transaction?.tags?.length
    ? transaction.tags.map((tag) => tag.name).join(", ")
    : "",
  reimbursement_category_id: transaction?.reimbursement_category_id ?? "",
  reimbursement_of_transaction_id:
    transaction?.reimbursement_of_transaction_id ?? "",
  is_recurring: transaction?.is_recurring ?? false,
  is_transfer: transaction?.is_transfer ?? false,
  is_reimbursement: transaction?.is_reimbursement ?? false,
  is_shared: transaction?.is_shared ?? false,
});

export const TransactionFormModal = ({
  opened,
  onClose,
  transaction,
  categories,
  paymentMethods,
  accounts,
  readOnly = false,
}: TransactionFormModalProps) => {
  const mode = transaction ? "edit" : "create";
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const defaults = useMemo(
    () => (transaction ? null : loadTransactionDefaults(userId)),
    [transaction, userId],
  );
  const [form, setForm] = useState(() =>
    buildInitialForm(transaction, defaults),
  );
  const [error, setError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [sharedSplitOverride, setSharedSplitOverride] =
    useState<SharedSplitDraft | null>(null);
  const [sharedLinkOverride, setSharedLinkOverride] = useState<{
    shared_expense_id: string;
    shared_participant_id: string;
  } | null>(null);

  const [addTransaction, { isLoading: isSaving }] = useAddTransactionMutation();
  const [updateTransaction, { isLoading: isUpdating }] =
    useUpdateTransactionMutation();
  const [deleteTransaction, { isLoading: isDeleting }] =
    useDeleteTransactionMutation();
  const { data: rules = [] } = useGetRulesQuery();
  const { data: sharedExpenses = [], error: sharedExpensesError } =
    useGetSharedExpensesQuery();
  const isReimbursementIncome = form.type === "income" && form.is_reimbursement;
  const reimbursementRangeStart = useMemo(
    () =>
      dayjs(form.date)
        .subtract(18, "month")
        .startOf("month")
        .format("YYYY-MM-DD"),
    [form.date],
  );
  const reimbursementRangeEnd = useMemo(
    () => dayjs(form.date).endOf("day").format("YYYY-MM-DD"),
    [form.date],
  );
  const merchantRangeStart = useMemo(
    () =>
      dayjs(form.date)
        .subtract(18, "month")
        .startOf("month")
        .format("YYYY-MM-DD"),
    [form.date],
  );
  const merchantRangeEnd = useMemo(
    () => dayjs(form.date).endOf("day").format("YYYY-MM-DD"),
    [form.date],
  );
  const {
    data: reimbursementCandidates = [],
    error: reimbursementCandidatesError,
  } = useGetTransactionsByRangeQuery(
    { start: reimbursementRangeStart, end: reimbursementRangeEnd },
    { skip: !opened || !isReimbursementIncome },
  );
  const { data: merchantHistory = [] } = useGetTransactionsByRangeQuery(
    { start: merchantRangeStart, end: merchantRangeEnd },
    { skip: !opened, refetchOnMountOrArgChange: true },
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  );
  const expenseCategoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.type === "expense")
        .map((category) => ({
          value: category.id,
          label: category.name,
        })),
    [categories],
  );
  const defaultAccountId = accounts[0]?.id ?? "";
  const effectiveAccountId = form.account_id || defaultAccountId;

  const paymentOptions = useMemo(() => {
    const selectedAccount = accounts.find(
      (acc) => acc.id === effectiveAccountId,
    );
    const isCardAccount = selectedAccount?.type === "card";

    return paymentMethods
      .filter((method) => {
        if (!isCardAccount) return true;
        const name = method.name.toLowerCase();
        return name.includes("card") || name.includes("pos");
      })
      .map((method) => ({
        value: method.id,
        label: method.name,
      }));
  }, [paymentMethods, accounts, effectiveAccountId]);
  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${account.type === "card" ? "Credit card" : account.type}`,
      })),
    [accounts],
  );
  const defaultCardPaymentId = useMemo(() => {
    const match = paymentMethods.find((pm) =>
      pm.name.toLowerCase().includes("card"),
    );
    return match?.id ?? null;
  }, [paymentMethods]);
  const accountForDefault = accounts.find(
    (acc) => acc.id === effectiveAccountId,
  );
  const shouldDefaultPayment =
    !form.payment_method_id &&
    !paymentTouched &&
    accountForDefault?.type === "card" &&
    defaultCardPaymentId;
  const effectivePaymentMethodId =
    form.payment_method_id ||
    (shouldDefaultPayment ? defaultCardPaymentId : "");
  const shouldShowAdvanced =
    Boolean(form.tags.trim()) ||
    form.is_recurring ||
    form.is_transfer ||
    form.is_reimbursement ||
    form.is_shared ||
    Boolean(form.reimbursement_category_id);

  const sharedExpenseOptions = useMemo(
    () =>
      sharedExpenses.map((shared) => ({
        value: shared.id,
        label: `${dayjs(shared.transaction.date).format("DD MMM")} · ${
          shared.transaction.category_id
            ? (categoryMap.get(shared.transaction.category_id) ??
              "Uncategorized")
            : "Uncategorized"
        } · ${formatINR(shared.transaction.amount)}`,
      })),
    [sharedExpenses, categoryMap],
  );

  const derivedSharedSplit = useMemo<SharedSplitDraft>(() => {
    if (transaction?.type === "expense" && transaction.is_shared) {
      const match = sharedExpenses.find(
        (shared) => shared.transaction.id === transaction.id,
      );
      if (match) {
        return {
          mode: "custom",
          participants: match.participants.map((participant) => ({
            id: participant.id,
            name: participant.name,
            share_amount: String(participant.share_amount),
          })),
        };
      }
    }
    return { mode: "even", participants: [] };
  }, [transaction, sharedExpenses]);

  const sharedSplit = sharedSplitOverride ?? derivedSharedSplit;

  const derivedSharedLink = useMemo(() => {
    if (transaction?.type === "income" && transaction.is_reimbursement) {
      const reimbursementMatch = sharedExpenses
        .flatMap((shared) =>
          shared.reimbursements.map((reimbursement) => ({
            shared_expense_id: shared.id,
            transaction_id: reimbursement.transaction_id,
            participant_id: reimbursement.participant_id,
          })),
        )
        .find((item) => item.transaction_id === transaction.id);
      if (reimbursementMatch) {
        return {
          shared_expense_id: reimbursementMatch.shared_expense_id,
          shared_participant_id: reimbursementMatch.participant_id ?? "",
        };
      }
    }
    return { shared_expense_id: "", shared_participant_id: "" };
  }, [transaction, sharedExpenses]);

  const sharedLink = sharedLinkOverride ?? derivedSharedLink;

  const selectedSharedExpense = useMemo(
    () =>
      sharedExpenses.find(
        (shared) => shared.id === sharedLink.shared_expense_id,
      ) ?? null,
    [sharedExpenses, sharedLink.shared_expense_id],
  );
  const participantOptions = useMemo(
    () =>
      selectedSharedExpense?.participants.map((participant) => ({
        value: participant.id,
        label: participant.name,
      })) ?? [],
    [selectedSharedExpense],
  );
  const reimbursementExpenseOptions = useMemo(
    () =>
      reimbursementCandidates
        .filter((candidate) => candidate.type === "expense")
        .filter((candidate) => !candidate.is_transfer)
        .filter((candidate) => candidate.id !== transaction?.id)
        .map((candidate) => {
          const categoryLabel = candidate.category_id
            ? (categoryMap.get(candidate.category_id) ?? "Uncategorized")
            : "Uncategorized";
          const counterpartyLabel = getTransactionCounterpartyName(candidate);
          const contextLabel = counterpartyLabel
            ? ` · ${counterpartyLabel.slice(0, 36)}`
            : candidate.notes?.trim()
              ? ` · ${candidate.notes.trim().slice(0, 36)}`
              : "";
          return {
            value: candidate.id,
            label: `${dayjs(candidate.date).format("DD MMM")} · ${categoryLabel} · ${formatINR(
              candidate.amount,
            )}${contextLabel}`,
          };
        }),
    [reimbursementCandidates, transaction?.id, categoryMap],
  );
  const canShowLinkingError =
    isReimbursementIncome &&
    (hasQueryError(sharedExpensesError) ||
      hasQueryError(reimbursementCandidatesError));
  const merchantOptions = useMemo(
    () => buildFrequentMerchantOptions(merchantHistory, 200),
    [merchantHistory],
  );

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) {
      setError("Demo mode is read-only. You can browse but not save changes.");
      return;
    }
    setError(null);

    const amountValue = Number(form.amount);
    const selectedAccount = accounts.find(
      (acc) => acc.id === effectiveAccountId,
    );
    const selectedPayment = paymentMethods.find(
      (pm) => pm.id === effectivePaymentMethodId,
    );
    const reimbursementCategoryId = isReimbursementIncome
      ? form.reimbursement_category_id || null
      : null;
    const reimbursementOfTransactionId = isReimbursementIncome
      ? sharedLink.shared_expense_id
        ? (selectedSharedExpense?.transaction.id ?? null)
        : form.reimbursement_of_transaction_id || null
      : null;

    if (!form.amount || Number.isNaN(amountValue)) {
      setError("Enter a valid amount.");
      return;
    }

    if (!effectiveAccountId) {
      setError("Select an account to keep balances in sync.");
      return;
    }

    if (isReimbursementIncome && !reimbursementCategoryId) {
      setError("Select an expense category to offset.");
      return;
    }

    if (
      selectedAccount?.type === "card" &&
      effectivePaymentMethodId &&
      !selectedPayment?.name.toLowerCase().includes("card")
    ) {
      setError("Card accounts should use a card/pos payment method.");
      return;
    }

    const sharedParticipants = sharedSplit.participants
      .map((participant) => ({
        name: participant.name.trim(),
        share_amount: Number(participant.share_amount),
      }))
      .filter(
        (participant) =>
          participant.name && !Number.isNaN(participant.share_amount),
      );
    const participantsTotal = sharedParticipants.reduce(
      (sum, participant) => sum + participant.share_amount,
      0,
    );

    if (form.type === "expense" && form.is_shared) {
      if (sharedParticipants.length === 0) {
        setError("Add at least one participant for the shared split.");
        return;
      }
      if (participantsTotal > amountValue) {
        setError("Shared split exceeds the transaction amount.");
        return;
      }
    }

    if (
      isReimbursementIncome &&
      sharedLink.shared_expense_id &&
      !sharedLink.shared_participant_id
    ) {
      setError("Select who the reimbursement is from.");
      return;
    }

    try {
      const baseTags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const ruled = applyRulesToTransaction(
        {
          merchant: form.merchant.trim() ? form.merchant.trim() : null,
          notes: form.notes.trim() ? form.notes.trim() : null,
          type: form.type,
          category_id: isReimbursementIncome ? null : form.category_id || null,
          tags: baseTags,
        },
        rules,
      );
      const payload = {
        type: form.type,
        date: form.date,
        amount: amountValue,
        category_id: isReimbursementIncome ? null : ruled.category_id,
        reimbursement_category_id: reimbursementCategoryId,
        reimbursement_of_transaction_id: reimbursementOfTransactionId,
        payment_method_id: effectivePaymentMethodId || null,
        account_id: effectiveAccountId || null,
        merchant: form.merchant.trim() ? form.merchant.trim() : null,
        notes: form.notes.trim() ? form.notes.trim() : null,
        tags: ruled.tags,
        is_transfer: form.is_transfer,
        is_recurring: form.is_recurring,
        is_reimbursement: isReimbursementIncome,
        is_shared: form.type === "expense" ? form.is_shared : false,
        sharedSplit:
          form.type === "expense" && form.is_shared
            ? { participants: sharedParticipants }
            : null,
        sharedReimbursement:
          isReimbursementIncome && sharedLink.shared_expense_id
            ? {
                shared_expense_id: sharedLink.shared_expense_id,
                participant_id: sharedLink.shared_participant_id || null,
              }
            : null,
      };

      if (transaction?.id) {
        await updateTransaction({
          id: transaction.id,
          ...payload,
        }).unwrap();
      } else {
        await addTransaction(payload).unwrap();
      }

      if (!isReimbursementIncome) {
        saveTransactionDefaults(userId, {
          account_id: effectiveAccountId || "",
          payment_method_id: effectivePaymentMethodId || "",
          category_id: ruled.category_id ?? "",
        });
      }
      onClose();
    } catch {
      setError(
        mode === "edit"
          ? "Unable to update the transaction."
          : "Unable to save the transaction.",
      );
    }
  };

  const handleOpenDelete = () => {
    if (!transaction) {
      return;
    }
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const handleCloseDelete = () => {
    setIsDeleteOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!transaction) {
      return;
    }

    try {
      await deleteTransaction({ id: transaction.id }).unwrap();
      setIsDeleteOpen(false);
      onClose();
    } catch {
      setDeleteError("Unable to delete the transaction.");
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={mode === "edit" ? "Edit transaction" : "Add transaction"}
        size="lg"
      >
        <Stack component="form" gap="sm" onSubmit={handleSubmit}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Type"
              data={[
                { value: "expense", label: "Expense" },
                { value: "income", label: "Income" },
              ]}
              value={form.type}
              onChange={(value) =>
                setForm((prev) => {
                  const nextType = (value ?? "expense") as "expense" | "income";
                  if (nextType === "income") {
                    return {
                      ...prev,
                      type: nextType,
                      is_shared: false,
                    };
                  }
                  return {
                    ...prev,
                    type: nextType,
                    is_reimbursement: false,
                    reimbursement_category_id: "",
                    reimbursement_of_transaction_id: "",
                  };
                })
              }
              allowDeselect={false}
            />
            <DateInput
              label="Date"
              value={dayjs(form.date).toDate()}
              onChange={(value) =>
                value &&
                setForm((prev) => ({
                  ...prev,
                  date: dayjs(value).format("YYYY-MM-DD"),
                }))
              }
              required
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Amount"
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
            <Select
              label={isReimbursementIncome ? "Offset category" : "Category"}
              data={
                isReimbursementIncome ? expenseCategoryOptions : categoryOptions
              }
              value={
                isReimbursementIncome
                  ? form.reimbursement_category_id || null
                  : form.category_id || null
              }
              onChange={(value) =>
                setForm((prev) =>
                  isReimbursementIncome
                    ? { ...prev, reimbursement_category_id: value ?? "" }
                    : { ...prev, category_id: value ?? "" },
                )
              }
              placeholder="Select"
              clearable={!isReimbursementIncome}
              required={isReimbursementIncome}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Account (bank/card/wallet)"
              data={accountOptions}
              value={effectiveAccountId || null}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, account_id: value ?? "" }))
              }
              placeholder="Select"
              required
              searchable
              clearable
            />
            <Select
              label="Payment method (channel)"
              data={paymentOptions}
              value={effectivePaymentMethodId || null}
              onChange={(value) => {
                setPaymentTouched(true);
                setForm((prev) => ({
                  ...prev,
                  payment_method_id: value ?? "",
                }));
              }}
              placeholder="e.g., UPI, POS, Cash"
              clearable
              onDropdownOpen={() => setPaymentTouched(true)}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Autocomplete
              label="Counterparty / payee / place"
              data={merchantOptions}
              value={form.merchant}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, merchant: value }))
              }
              placeholder="e.g., Reliance Fresh, Swiggy, Rahul"
              limit={8}
              maxDropdownHeight={220}
            />
            <Textarea
              label="Notes (what you bought / context)"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Optional details"
              minRows={2}
            />
          </SimpleGrid>
          <Accordion
            variant="separated"
            radius="md"
            defaultValue={shouldShowAdvanced ? "advanced" : undefined}
          >
            <Accordion.Item value="advanced">
              <Accordion.Control>
                <Stack gap={2}>
                  <Text fw={600}>Advanced options</Text>
                  <Text size="xs" c="dimmed">
                    Transfers, shared splits, recurring flags, and tags.
                  </Text>
                </Stack>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Text size="xs" c="dimmed">
                    Use these flags to keep budgets and reports accurate.
                  </Text>
                  <TextInput
                    label="Tags"
                    name="tags"
                    value={form.tags}
                    onChange={handleChange}
                    placeholder="food, weekend, work"
                  />
                  {form.type === "income" ? (
                    <Checkbox
                      label="This income is a reimbursement/refund"
                      description="Offsets a past expense instead of counting as new income."
                      checked={form.is_reimbursement}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setForm((prev) => ({
                          ...prev,
                          is_reimbursement: checked,
                          is_transfer: checked ? false : prev.is_transfer,
                          reimbursement_category_id: checked
                            ? prev.reimbursement_category_id ||
                              prev.category_id ||
                              ""
                            : "",
                          reimbursement_of_transaction_id: checked
                            ? prev.reimbursement_of_transaction_id
                            : "",
                        }));
                        if (!checked) {
                          setSharedLinkOverride(null);
                        }
                      }}
                    />
                  ) : null}
                  {isReimbursementIncome ? (
                    <Stack gap="xs">
                      {canShowLinkingError ? (
                        <Alert color="orange" variant="light">
                          Unable to load linkable reimbursements. Run the latest
                          DB migration and refresh.
                        </Alert>
                      ) : null}
                      <Text size="xs" c="dimmed">
                        Shared-expense linking is optional. Leave this blank for
                        personal repayments (for example, when someone returns
                        money you lent).
                      </Text>
                      <Select
                        label="Related shared expense (optional)"
                        data={sharedExpenseOptions}
                        value={sharedLink.shared_expense_id || null}
                        onChange={(value) =>
                          setSharedLinkOverride({
                            shared_expense_id: value ?? "",
                            shared_participant_id: "",
                          })
                        }
                        placeholder="Select shared expense"
                        searchable
                        clearable
                      />
                      <Select
                        label="Expense being reimbursed (optional)"
                        data={reimbursementExpenseOptions}
                        value={form.reimbursement_of_transaction_id || null}
                        onChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            reimbursement_of_transaction_id: value ?? "",
                          }))
                        }
                        placeholder="Select earlier expense"
                        searchable
                        clearable
                        disabled={Boolean(sharedLink.shared_expense_id)}
                      />
                      {sharedExpenseOptions.length === 0 &&
                      reimbursementExpenseOptions.length === 0 &&
                      !canShowLinkingError ? (
                        <Text size="xs" c="dimmed">
                          No linkable records found yet. Add an expense first,
                          then link reimbursement to it.
                        </Text>
                      ) : null}
                      <Select
                        label="Reimbursed by (optional)"
                        data={participantOptions}
                        value={sharedLink.shared_participant_id || null}
                        onChange={(value) =>
                          setSharedLinkOverride((prev) => ({
                            shared_expense_id:
                              prev?.shared_expense_id ??
                              sharedLink.shared_expense_id,
                            shared_participant_id: value ?? "",
                          }))
                        }
                        placeholder={
                          sharedLink.shared_expense_id
                            ? "Select participant"
                            : "Pick a shared expense first"
                        }
                        disabled={!sharedLink.shared_expense_id}
                        searchable
                        clearable
                      />
                    </Stack>
                  ) : null}
                  {form.type === "expense" ? (
                    <Checkbox
                      label="Shared expense (split with others)"
                      description="Track who owes you; your share stays as the net expense."
                      checked={form.is_shared}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setForm((prev) => ({
                          ...prev,
                          is_shared: checked,
                          is_transfer: checked ? false : prev.is_transfer,
                        }));
                      }}
                    />
                  ) : null}
                  {form.type === "expense" && form.is_shared ? (
                    <SharedSplitEditor
                      totalAmount={Number(form.amount) || 0}
                      value={sharedSplit}
                      onChange={setSharedSplitOverride}
                    />
                  ) : null}
                  <Checkbox
                    label="Exclude from budgets/income (transfer, internal move)"
                    description="Use for moving money between your own accounts."
                    checked={form.is_transfer}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        is_transfer: event?.currentTarget?.checked ?? false,
                        is_shared: event?.currentTarget?.checked
                          ? false
                          : prev.is_shared,
                        is_reimbursement: event?.currentTarget?.checked
                          ? false
                          : prev.is_reimbursement,
                        reimbursement_category_id: event?.currentTarget?.checked
                          ? ""
                          : prev.reimbursement_category_id,
                        reimbursement_of_transaction_id: event?.currentTarget
                          ?.checked
                          ? ""
                          : prev.reimbursement_of_transaction_id,
                      }))
                    }
                  />
                  <Checkbox
                    label="Mark as recurring (monthly)"
                    description="Flags the transaction only; no auto-post yet."
                    checked={form.is_recurring}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        is_recurring: event?.currentTarget?.checked ?? false,
                      }))
                    }
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          {error ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}
          {readOnly ? (
            <Alert color="orange" variant="light">
              Demo mode: edits and deletions are disabled.
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={onClose}>
              Cancel
            </Button>
            {mode === "edit" ? (
              <Button
                variant="light"
                color="red"
                onClick={handleOpenDelete}
                disabled={readOnly}
              >
                Delete
              </Button>
            ) : null}
            <Button
              type="submit"
              loading={isSaving || isUpdating}
              color="green"
              disabled={readOnly}
            >
              {mode === "edit" ? "Save changes" : "Save transaction"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={isDeleteOpen}
        onClose={handleCloseDelete}
        title="Delete transaction"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">
            Delete the{" "}
            <Text component="span" fw={600}>
              {formatINR(transaction?.amount ?? 0)}
            </Text>{" "}
            {transaction?.type === "expense" ? "expense" : "income"} from{" "}
            <Text component="span" fw={600}>
              {transaction?.category_id
                ? (categoryMap.get(transaction.category_id) ?? "this category")
                : "Uncategorized"}
            </Text>
            ?
          </Text>
          {deleteError ? (
            <Alert color="red" variant="light">
              {deleteError}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={handleCloseDelete}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={isDeleting}
              onClick={handleConfirmDelete}
            >
              Delete transaction
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
