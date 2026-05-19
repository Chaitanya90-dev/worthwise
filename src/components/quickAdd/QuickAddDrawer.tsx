import {
  Accordion,
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Drawer,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appPath } from "../../app/paths";
import {
  useAddFundContributionMutation,
  useAddSubscriptionMutation,
  useAddTransactionMutation,
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetFundsQuery,
  useGetPaymentMethodsQuery,
  useGetRulesQuery,
  useGetSharedExpensesQuery,
  useGetTransactionsByRangeQuery,
} from "../../features/api/apiSlice";
import { applyRulesToTransaction } from "../../lib/rules";
import {
  loadTransactionDefaults,
  saveTransactionDefaults,
} from "../../lib/preferences";
import { buildFrequentMerchantOptions } from "../../lib/merchant";
import { useAppSelector } from "../../app/hooks";
import { formatINR } from "../../lib/format";
import { getBaseCurrency } from "../../lib/moneyConfig";
import {
  SharedSplitEditor,
  type SharedSplitDraft,
} from "../shared/SharedSplitEditor";

type QuickAddDrawerProps = {
  opened: boolean;
  onClose: () => void;
  readOnly?: boolean;
};

type QuickMode = "expense" | "income" | "fund" | "subscription";

type QuickTransactionForm = {
  type: "expense" | "income";
  date: string;
  amount: string;
  category_id: string;
  reimbursement_category_id: string;
  reimbursement_of_transaction_id: string;
  shared_expense_id: string;
  shared_participant_id: string;
  is_reimbursement: boolean;
  is_transfer: boolean;
  is_recurring: boolean;
  is_shared: boolean;
  tags: string;
  account_id: string;
  payment_method_id: string;
  merchant: string;
  notes: string;
};

type QuickFundForm = {
  fund_id: string;
  date: string;
  amount: string;
  note: string;
};

type QuickSubscriptionForm = {
  name: string;
  amount: string;
  interval_months: string;
  next_due: string;
  category_id: string;
  account_id: string;
  payment_method_id: string;
  notes: string;
};

const hasQueryError = (value: unknown) => Boolean(value);

const buildTransactionForm = (
  defaults: ReturnType<typeof loadTransactionDefaults> | null,
  type: "expense" | "income"
): QuickTransactionForm => ({
  type,
  date: dayjs().format("YYYY-MM-DD"),
  amount: "",
  category_id: defaults?.category_id ?? "",
  reimbursement_category_id: "",
  reimbursement_of_transaction_id: "",
  shared_expense_id: "",
  shared_participant_id: "",
  is_reimbursement: false,
  is_transfer: false,
  is_recurring: false,
  is_shared: false,
  tags: "",
  account_id: defaults?.account_id ?? "",
  payment_method_id: defaults?.payment_method_id ?? "",
  merchant: "",
  notes: "",
});

const buildFundForm = (): QuickFundForm => ({
  fund_id: "",
  date: dayjs().format("YYYY-MM-DD"),
  amount: "",
  note: "",
});

const buildSubscriptionForm = (): QuickSubscriptionForm => ({
  name: "",
  amount: "",
  interval_months: "1",
  next_due: dayjs().format("YYYY-MM-DD"),
  category_id: "",
  account_id: "",
  payment_method_id: "",
  notes: "",
});

export const QuickAddDrawer = ({
  opened,
  onClose,
  readOnly = false,
}: QuickAddDrawerProps) => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const navigate = useNavigate();
  const defaults = useMemo(() => loadTransactionDefaults(userId), [userId]);

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: funds = [] } = useGetFundsQuery();
  const { data: rules = [] } = useGetRulesQuery();
  const {
    data: sharedExpenses = [],
    error: sharedExpensesError,
  } = useGetSharedExpensesQuery();

  const [addTransaction, { isLoading: isSavingTransaction }] =
    useAddTransactionMutation();
  const [addFundContribution, { isLoading: isSavingFund }] =
    useAddFundContributionMutation();
  const [addSubscription, { isLoading: isSavingSubscription }] =
    useAddSubscriptionMutation();

  const [mode, setMode] = useState<QuickMode>("expense");
  const [transactionForm, setTransactionForm] = useState<QuickTransactionForm>(
    () => buildTransactionForm(defaults, "expense")
  );
  const [sharedSplit, setSharedSplit] = useState<SharedSplitDraft>({
    mode: "even",
    participants: [],
  });
  const [fundForm, setFundForm] = useState<QuickFundForm>(() => buildFundForm());
  const [subscriptionForm, setSubscriptionForm] = useState<QuickSubscriptionForm>(
    () => buildSubscriptionForm()
  );
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReimbursementIncome =
    transactionForm.type === "income" && transactionForm.is_reimbursement;
  const reimbursementRangeStart = useMemo(
    () =>
      dayjs(transactionForm.date)
        .subtract(18, "month")
        .startOf("month")
        .format("YYYY-MM-DD"),
    [transactionForm.date]
  );
  const reimbursementRangeEnd = useMemo(
    () => dayjs(transactionForm.date).endOf("day").format("YYYY-MM-DD"),
    [transactionForm.date]
  );
  const merchantRangeStart = useMemo(
    () =>
      dayjs(transactionForm.date)
        .subtract(18, "month")
        .startOf("month")
        .format("YYYY-MM-DD"),
    [transactionForm.date]
  );
  const merchantRangeEnd = useMemo(
    () => dayjs(transactionForm.date).endOf("day").format("YYYY-MM-DD"),
    [transactionForm.date]
  );
  const { data: reimbursementCandidates = [], error: reimbursementCandidatesError } =
    useGetTransactionsByRangeQuery(
      { start: reimbursementRangeStart, end: reimbursementRangeEnd },
      { skip: !opened || !isReimbursementIncome }
    );
  const { data: merchantHistory = [] } = useGetTransactionsByRangeQuery(
    { start: merchantRangeStart, end: merchantRangeEnd },
    { skip: !opened, refetchOnMountOrArgChange: true }
  );

  const resetState = () => {
    const nextDefaults = loadTransactionDefaults(userId);
    setMode("expense");
    setTransactionForm(buildTransactionForm(nextDefaults, "expense"));
    setSharedSplit({ mode: "even", participants: [] });
    setFundForm(buildFundForm());
    setSubscriptionForm(buildSubscriptionForm());
    setPaymentTouched(false);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleOpenFullForm = () => {
    handleClose();
    navigate(appPath("/transactions?action=new"));
  };

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const expenseCategoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.type === "expense")
        .map((category) => ({
          value: category.id,
          label: category.name,
        })),
    [categories]
  );
  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${account.type === "card" ? "Credit card" : account.type}`,
      })),
    [accounts]
  );
  const paymentOptions = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method.id,
        label: method.name,
      })),
    [paymentMethods]
  );
  const sharedExpenseOptions = useMemo(
    () =>
      sharedExpenses.map((shared) => ({
        value: shared.id,
        label: `${dayjs(shared.transaction.date).format("DD MMM")} · ${
          shared.transaction.category_id
            ? categoryMap.get(shared.transaction.category_id) ?? "Uncategorized"
            : "Uncategorized"
        } · ${formatINR(shared.transaction.amount)}`,
      })),
    [sharedExpenses, categoryMap]
  );
  const activeFunds = useMemo(
    () => funds.filter((fund) => !fund.is_archived),
    [funds]
  );
  const selectedSharedExpense = useMemo(
    () =>
      sharedExpenses.find((shared) => shared.id === transactionForm.shared_expense_id) ??
      null,
    [sharedExpenses, transactionForm.shared_expense_id]
  );
  const participantOptions = useMemo(
    () =>
      selectedSharedExpense?.participants.map((participant) => ({
        value: participant.id,
        label: participant.name,
      })) ?? [],
    [selectedSharedExpense]
  );
  const fundOptions = useMemo(
    () =>
      activeFunds.map((fund) => ({
        value: fund.id,
        label: fund.name,
      })),
    [activeFunds]
  );
  const cashOnHand = useMemo(
    () => accounts.reduce((sum, account) => sum + (account.current_balance ?? 0), 0),
    [accounts]
  );
  const allocatedFunds = useMemo(
    () => activeFunds.reduce((sum, fund) => sum + fund.current_amount, 0),
    [activeFunds]
  );
  const unallocatedCash = cashOnHand - allocatedFunds;
  const unallocatedLabel =
    unallocatedCash >= 0
      ? `Unallocated cash ${formatINR(unallocatedCash)}`
      : `Over-allocated by ${formatINR(Math.abs(unallocatedCash))}`;

  const defaultAccountId = accounts[0]?.id ?? "";
  const effectiveAccountId = transactionForm.account_id || defaultAccountId;
  const accountForDefault = accounts.find((acc) => acc.id === effectiveAccountId);
  const defaultCardPaymentId = useMemo(() => {
    const match = paymentMethods.find((pm) => pm.name.toLowerCase().includes("card"));
    return match?.id ?? null;
  }, [paymentMethods]);
  const shouldDefaultPayment =
    !transactionForm.payment_method_id &&
    !paymentTouched &&
    accountForDefault?.type === "card" &&
    defaultCardPaymentId;
  const effectivePaymentMethodId =
    transactionForm.payment_method_id ||
    (shouldDefaultPayment ? defaultCardPaymentId : "");
  const shouldShowAdvanced =
    Boolean(transactionForm.tags.trim()) ||
    transactionForm.is_shared ||
    transactionForm.is_transfer ||
    transactionForm.is_recurring;
  const reimbursementExpenseOptions = useMemo(
    () =>
      reimbursementCandidates
        .filter((candidate) => candidate.type === "expense")
        .filter((candidate) => !candidate.is_transfer)
        .map((candidate) => {
          const categoryLabel = candidate.category_id
            ? categoryMap.get(candidate.category_id) ?? "Uncategorized"
            : "Uncategorized";
          const contextLabel = candidate.merchant?.trim()
            ? ` · ${candidate.merchant.trim().slice(0, 36)}`
            : candidate.notes?.trim()
            ? ` · ${candidate.notes.trim().slice(0, 36)}`
            : "";
          return {
            value: candidate.id,
            label: `${dayjs(candidate.date).format("DD MMM")} · ${categoryLabel} · ${formatINR(
              candidate.amount
            )}${contextLabel}`,
          };
        }),
    [reimbursementCandidates, categoryMap]
  );
  const canShowLinkingError =
    isReimbursementIncome &&
    (hasQueryError(sharedExpensesError) ||
      hasQueryError(reimbursementCandidatesError));
  const merchantOptions = useMemo(
    () => buildFrequentMerchantOptions(merchantHistory, 200),
    [merchantHistory]
  );

  const handleModeChange = (value: string) => {
    const next = value as QuickMode;
    setMode(next);
    setError(null);
    if (next === "expense" || next === "income") {
      setTransactionForm((prev) => ({
        ...prev,
        type: next,
        is_reimbursement: next === "income" ? prev.is_reimbursement : false,
        reimbursement_category_id:
          next === "income" ? prev.reimbursement_category_id : "",
        reimbursement_of_transaction_id:
          next === "income" ? prev.reimbursement_of_transaction_id : "",
        is_shared: next === "income" ? false : prev.is_shared,
        shared_expense_id: next === "income" ? prev.shared_expense_id : "",
        shared_participant_id: next === "income" ? prev.shared_participant_id : "",
      }));
      if (next === "income") {
        setSharedSplit({ mode: "even", participants: [] });
      }
    }
  };

  const handleSaveTransaction = async () => {
    if (readOnly) {
      setError("Demo mode is read-only. You can browse but not save changes.");
      return;
    }
    setError(null);
    const amountValue = Number(transactionForm.amount);
    if (!transactionForm.amount || Number.isNaN(amountValue)) {
      setError("Enter a valid amount.");
      return;
    }
    if (!effectiveAccountId) {
      setError("Select an account to keep balances in sync.");
      return;
    }
    const reimbursementCategoryId = isReimbursementIncome
      ? transactionForm.reimbursement_category_id || null
      : null;
    const reimbursementOfTransactionId = isReimbursementIncome
      ? transactionForm.shared_expense_id
        ? selectedSharedExpense?.transaction.id ?? null
        : transactionForm.reimbursement_of_transaction_id || null
      : null;
    if (isReimbursementIncome && !reimbursementCategoryId) {
      setError("Select an expense category to offset.");
      return;
    }

    const sharedParticipants = sharedSplit.participants
      .map((participant) => ({
        name: participant.name.trim(),
        share_amount: Number(participant.share_amount),
      }))
      .filter(
        (participant) =>
          participant.name && !Number.isNaN(participant.share_amount)
      );
    const participantsTotal = sharedParticipants.reduce(
      (sum, participant) => sum + participant.share_amount,
      0
    );
    if (transactionForm.type === "expense" && transactionForm.is_shared) {
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
      transactionForm.shared_expense_id &&
      !transactionForm.shared_participant_id
    ) {
      setError("Select who the reimbursement is from.");
      return;
    }

    const baseTags = transactionForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const ruled = applyRulesToTransaction(
      {
        merchant: transactionForm.merchant.trim()
          ? transactionForm.merchant.trim()
          : null,
        notes: transactionForm.notes.trim()
          ? transactionForm.notes.trim()
          : null,
        type: transactionForm.type,
        category_id: isReimbursementIncome ? null : transactionForm.category_id || null,
        tags: baseTags,
      },
      rules
    );

    try {
      await addTransaction({
        type: transactionForm.type,
        date: transactionForm.date,
        amount: amountValue,
        category_id: isReimbursementIncome ? null : ruled.category_id,
        reimbursement_category_id: reimbursementCategoryId,
        reimbursement_of_transaction_id: reimbursementOfTransactionId,
        payment_method_id: effectivePaymentMethodId || null,
        account_id: effectiveAccountId || null,
        merchant: transactionForm.merchant.trim()
          ? transactionForm.merchant.trim()
          : null,
        notes: transactionForm.notes.trim() ? transactionForm.notes.trim() : null,
        tags: ruled.tags,
        is_transfer: transactionForm.is_transfer,
        is_recurring: transactionForm.is_recurring,
        is_reimbursement: isReimbursementIncome,
        is_shared: transactionForm.type === "expense" ? transactionForm.is_shared : false,
        sharedSplit:
          transactionForm.type === "expense" && transactionForm.is_shared
            ? { participants: sharedParticipants }
            : null,
        sharedReimbursement:
          isReimbursementIncome && transactionForm.shared_expense_id
            ? {
                shared_expense_id: transactionForm.shared_expense_id,
                participant_id: transactionForm.shared_participant_id || null,
              }
            : null,
      }).unwrap();

      if (!isReimbursementIncome) {
        saveTransactionDefaults(userId, {
          account_id: effectiveAccountId || "",
          payment_method_id: effectivePaymentMethodId || "",
          category_id: ruled.category_id ?? "",
        });
      }
      handleClose();
    } catch {
      setError("Unable to save the transaction.");
    }
  };

  const handleSaveFundContribution = async () => {
    if (readOnly) {
      setError("Demo mode is read-only. You can browse but not save changes.");
      return;
    }
    setError(null);
    if (!fundForm.fund_id) {
      setError("Select a fund.");
      return;
    }
    const selectedFund = activeFunds.find((fund) => fund.id === fundForm.fund_id);
    if (!selectedFund) {
      setError("Select an active fund.");
      return;
    }
    const amountValue = Math.abs(Number(fundForm.amount));
    if (!fundForm.amount || Number.isNaN(amountValue)) {
      setError("Enter a valid amount.");
      return;
    }
    if (amountValue <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (amountValue - unallocatedCash > 0.01) {
      setError(`Not enough unallocated cash. ${unallocatedLabel}.`);
      return;
    }

    try {
      await addFundContribution({
        fund_id: fundForm.fund_id,
        date: fundForm.date,
        amount: amountValue,
        note: fundForm.note.trim() ? fundForm.note.trim() : null,
      }).unwrap();
      handleClose();
    } catch {
      setError("Unable to save the contribution.");
    }
  };

  const handleSaveSubscription = async () => {
    if (readOnly) {
      setError("Demo mode is read-only. You can browse but not save changes.");
      return;
    }
    setError(null);
    if (!subscriptionForm.name.trim()) {
      setError("Enter a subscription name.");
      return;
    }
    if (!subscriptionForm.amount || Number.isNaN(Number(subscriptionForm.amount))) {
      setError("Enter a valid amount.");
      return;
    }
    if (!subscriptionForm.next_due) {
      setError("Select a next due date.");
      return;
    }

    const intervalMonths = Number(subscriptionForm.interval_months || 1);
    if (!intervalMonths || Number.isNaN(intervalMonths) || intervalMonths <= 0) {
      setError("Enter a valid billing cadence.");
      return;
    }

    try {
      const baseCurrency = getBaseCurrency();
      await addSubscription({
        name: subscriptionForm.name.trim(),
        amount: Number(subscriptionForm.amount),
        currency: baseCurrency,
        estimated_base_amount: Number(subscriptionForm.amount),
        interval_months: intervalMonths,
        billing_anchor: subscriptionForm.next_due,
        next_due: subscriptionForm.next_due,
        last_paid: null,
        last_billed_base_amount: null,
        last_fx_rate: null,
        status: "active",
        category_id: subscriptionForm.category_id || null,
        account_id: subscriptionForm.account_id || null,
        payment_method_id: subscriptionForm.payment_method_id || null,
        notes: subscriptionForm.notes.trim() ? subscriptionForm.notes.trim() : null,
      }).unwrap();
      handleClose();
    } catch {
      setError("Unable to save the subscription.");
    }
  };

  const primaryActionLabel =
    mode === "fund"
      ? "Save contribution"
      : mode === "subscription"
      ? "Save subscription"
      : "Save transaction";
  const isSaving = isSavingTransaction || isSavingFund || isSavingSubscription;

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title="Quick add"
      position="right"
      size="lg"
      padding="md"
    >
      <Stack gap="md">
        <SegmentedControl
          value={mode}
          onChange={handleModeChange}
          data={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "fund", label: "Fund" },
            { value: "subscription", label: "Subscription" },
          ]}
        />

        {(mode === "expense" || mode === "income") && (
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Amount"
                type="number"
                value={transactionForm.amount}
                onChange={(event) =>
                  setTransactionForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
              <DateInput
                label="Date"
                value={dayjs(transactionForm.date).toDate()}
                onChange={(value) =>
                  value &&
                  setTransactionForm((prev) => ({
                    ...prev,
                    date: dayjs(value).format("YYYY-MM-DD"),
                  }))
                }
                required
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label={isReimbursementIncome ? "Offset category" : "Category"}
                data={isReimbursementIncome ? expenseCategoryOptions : categoryOptions}
                value={
                  isReimbursementIncome
                    ? transactionForm.reimbursement_category_id || null
                    : transactionForm.category_id || null
                }
                onChange={(value) =>
                  setTransactionForm((prev) => ({
                    ...prev,
                    reimbursement_category_id: isReimbursementIncome
                      ? value ?? ""
                      : prev.reimbursement_category_id,
                    category_id: isReimbursementIncome ? prev.category_id : value ?? "",
                  }))
                }
                searchable
                clearable={!isReimbursementIncome}
                required={isReimbursementIncome}
              />
              <Select
                label="Account"
                data={accountOptions}
                value={effectiveAccountId || null}
                onChange={(value) =>
                  setTransactionForm((prev) => ({
                    ...prev,
                    account_id: value ?? "",
                  }))
                }
                required
                searchable
                clearable
              />
            </SimpleGrid>
            {mode === "income" ? (
              <Checkbox
                label="This income is a reimbursement/refund"
                description="Offsets a past expense instead of counting as new income."
                checked={transactionForm.is_reimbursement}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setTransactionForm((prev) => ({
                    ...prev,
                    is_reimbursement: checked,
                    reimbursement_category_id: checked
                      ? prev.reimbursement_category_id || prev.category_id || ""
                      : "",
                    reimbursement_of_transaction_id: checked
                      ? prev.reimbursement_of_transaction_id
                      : "",
                    shared_expense_id: checked ? prev.shared_expense_id : "",
                    shared_participant_id: checked ? prev.shared_participant_id : "",
                  }));
                }}
              />
            ) : null}
            {isReimbursementIncome ? (
              <Stack gap="xs">
                {canShowLinkingError ? (
                  <Alert color="orange" variant="light">
                    Unable to load linkable reimbursements. Run the latest DB
                    migration and refresh.
                  </Alert>
                ) : null}
                <Text size="xs" c="dimmed">
                  Shared-expense linking is optional. Leave it blank for
                  personal repayments.
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Select
                  label="Related shared expense (optional)"
                  data={sharedExpenseOptions}
                  value={transactionForm.shared_expense_id || null}
                  onChange={(value) =>
                    setTransactionForm((prev) => ({
                      ...prev,
                      shared_expense_id: value ?? "",
                      shared_participant_id: "",
                    }))
                  }
                  placeholder="Select shared expense"
                  searchable
                  clearable
                />
                <Select
                  label="Expense being reimbursed (optional)"
                  data={reimbursementExpenseOptions}
                  value={transactionForm.reimbursement_of_transaction_id || null}
                  onChange={(value) =>
                    setTransactionForm((prev) => ({
                      ...prev,
                      reimbursement_of_transaction_id: value ?? "",
                    }))
                  }
                  placeholder="Select earlier expense"
                  searchable
                  clearable
                  disabled={Boolean(transactionForm.shared_expense_id)}
                />
                {sharedExpenseOptions.length === 0 &&
                reimbursementExpenseOptions.length === 0 &&
                !canShowLinkingError ? (
                  <Text size="xs" c="dimmed">
                    No linkable records found yet. Add an expense first, then
                    link reimbursement to it.
                  </Text>
                ) : null}
                <Select
                  label="Reimbursed by (optional)"
                  data={participantOptions}
                  value={transactionForm.shared_participant_id || null}
                  onChange={(value) =>
                    setTransactionForm((prev) => ({
                      ...prev,
                      shared_participant_id: value ?? "",
                    }))
                  }
                  placeholder={
                    transactionForm.shared_expense_id
                      ? "Select participant"
                      : "Pick a shared expense first"
                  }
                  disabled={!transactionForm.shared_expense_id}
                  searchable
                  clearable
                />
                </SimpleGrid>
              </Stack>
            ) : null}
            <Select
              label="Payment method"
              data={paymentOptions}
              value={effectivePaymentMethodId || null}
              onChange={(value) => {
                setPaymentTouched(true);
                setTransactionForm((prev) => ({
                  ...prev,
                  payment_method_id: value ?? "",
                }));
              }}
              placeholder="UPI, POS, Cash"
              clearable
              searchable
              onDropdownOpen={() => setPaymentTouched(true)}
            />
            <Autocomplete
              label="Merchant / payee / place"
              data={merchantOptions}
              value={transactionForm.merchant}
              onChange={(event) =>
                setTransactionForm((prev) => ({
                  ...prev,
                  merchant: event,
                }))
              }
              placeholder="e.g., Reliance Fresh, Swiggy, Rahul"
              limit={8}
              maxDropdownHeight={220}
            />
            <Textarea
              label="Notes (what you bought / context)"
              value={transactionForm.notes}
              onChange={(event) =>
                setTransactionForm((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional details"
              minRows={2}
            />
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
                      value={transactionForm.tags}
                      onChange={(event) =>
                        setTransactionForm((prev) => ({
                          ...prev,
                          tags: event.target.value,
                        }))
                      }
                      placeholder="food, weekend, work"
                    />
                    {transactionForm.type === "expense" ? (
                      <Checkbox
                        label="Shared expense (split with others)"
                        description="Track who owes you; your share stays as the net expense."
                        checked={transactionForm.is_shared}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setTransactionForm((prev) => ({
                            ...prev,
                            is_shared: checked,
                            is_transfer: checked ? false : prev.is_transfer,
                          }));
                        }}
                      />
                    ) : null}
                    {transactionForm.type === "expense" &&
                    transactionForm.is_shared ? (
                      <SharedSplitEditor
                        totalAmount={Number(transactionForm.amount) || 0}
                        value={sharedSplit}
                        onChange={setSharedSplit}
                      />
                    ) : null}
                    <Checkbox
                      label="Exclude from budgets/income (transfer, internal move)"
                      description="Use for moving money between your own accounts."
                      checked={transactionForm.is_transfer}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setTransactionForm((prev) => ({
                          ...prev,
                          is_transfer: checked,
                          is_shared: checked ? false : prev.is_shared,
                          is_reimbursement: checked ? false : prev.is_reimbursement,
                          reimbursement_category_id: checked
                            ? ""
                            : prev.reimbursement_category_id,
                          reimbursement_of_transaction_id: checked
                            ? ""
                            : prev.reimbursement_of_transaction_id,
                        }));
                      }}
                    />
                    <Checkbox
                      label="Mark as recurring (monthly)"
                      description="Flags the transaction only; no auto-post yet."
                      checked={transactionForm.is_recurring}
                      onChange={(event) =>
                        setTransactionForm((prev) => ({
                          ...prev,
                          is_recurring: event.currentTarget.checked,
                        }))
                      }
                    />
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
            <Button variant="subtle" size="xs" onClick={handleOpenFullForm}>
              Open full form
            </Button>
          </Stack>
        )}

        {mode === "fund" && (
          <Stack gap="sm">
            <Select
              label="Fund"
              data={fundOptions}
              value={fundForm.fund_id || null}
              onChange={(value) =>
                setFundForm((prev) => ({ ...prev, fund_id: value ?? "" }))
              }
              required
              searchable
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Amount"
                type="number"
                value={fundForm.amount}
                onChange={(event) =>
                  setFundForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
              <DateInput
                label="Date"
                value={dayjs(fundForm.date).toDate()}
                onChange={(value) =>
                  value &&
                  setFundForm((prev) => ({
                    ...prev,
                    date: dayjs(value).format("YYYY-MM-DD"),
                  }))
                }
                required
              />
            </SimpleGrid>
            <Text size="xs" c={unallocatedCash >= 0 ? "dimmed" : "red.6"}>
              {unallocatedLabel}
            </Text>
            <Textarea
              label="Note"
              value={fundForm.note}
              onChange={(event) =>
                setFundForm((prev) => ({ ...prev, note: event.target.value }))
              }
              placeholder="Optional note"
              minRows={2}
            />
          </Stack>
        )}

        {mode === "subscription" && (
          <Stack gap="sm">
            <TextInput
              label="Subscription name"
              value={subscriptionForm.name}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Netflix, Spotify"
              required
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Amount"
                type="number"
                value={subscriptionForm.amount}
                onChange={(event) =>
                  setSubscriptionForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
              <Select
                label="Cadence"
                value={subscriptionForm.interval_months}
                data={[
                  { value: "1", label: "Monthly" },
                  { value: "12", label: "Yearly" },
                ]}
                onChange={(value) =>
                  setSubscriptionForm((prev) => ({
                    ...prev,
                    interval_months: value ?? "1",
                  }))
                }
                required
              />
            </SimpleGrid>
            <DateInput
              label="Next due"
              value={dayjs(subscriptionForm.next_due).toDate()}
              onChange={(value) =>
                value &&
                setSubscriptionForm((prev) => ({
                  ...prev,
                  next_due: dayjs(value).format("YYYY-MM-DD"),
                }))
              }
              required
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label="Category"
                data={categoryOptions}
                value={subscriptionForm.category_id || null}
                onChange={(value) =>
                  setSubscriptionForm((prev) => ({
                    ...prev,
                    category_id: value ?? "",
                  }))
                }
                searchable
                clearable
              />
              <Select
                label="Account"
                data={accountOptions}
                value={subscriptionForm.account_id || null}
                onChange={(value) =>
                  setSubscriptionForm((prev) => ({
                    ...prev,
                    account_id: value ?? "",
                  }))
                }
                searchable
                clearable
              />
            </SimpleGrid>
            <Select
              label="Payment method"
              data={paymentOptions}
              value={subscriptionForm.payment_method_id || null}
              onChange={(value) =>
                setSubscriptionForm((prev) => ({
                  ...prev,
                  payment_method_id: value ?? "",
                }))
              }
              searchable
              clearable
            />
            <Textarea
              label="Notes"
              value={subscriptionForm.notes}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional details"
              minRows={2}
            />
          </Stack>
        )}

        {readOnly ? (
          <Alert color="orange" variant="light">
            Demo mode: changes are disabled for this account.
          </Alert>
        ) : null}
        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}

        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Quick add uses smart defaults for account, payment, and category.
          </Text>
          <Group gap="sm">
            <Button variant="subtle" color="gray" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              color="green"
              loading={isSaving}
              disabled={readOnly}
              onClick={() => {
                if (mode === "fund") {
                  void handleSaveFundContribution();
                } else if (mode === "subscription") {
                  void handleSaveSubscription();
                } else {
                  void handleSaveTransaction();
                }
              }}
            >
              {primaryActionLabel}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
};
