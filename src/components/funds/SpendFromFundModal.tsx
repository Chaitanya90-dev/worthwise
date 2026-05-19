import {
  Alert,
  Button,
  Group,
  Modal,
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
import type { FormEvent } from "react";
import {
  useAddFundContributionMutation,
  useAddTransactionMutation,
  useDeleteTransactionMutation,
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
} from "../../features/api/apiSlice";
import { formatINR } from "../../lib/format";
import type { Fund } from "../../types/finance";

type SpendFromFundModalProps = {
  opened: boolean;
  onClose: () => void;
  funds: Fund[];
  defaultFund?: Fund | null;
  readOnly?: boolean;
};

const buildInitialForm = (defaultFund?: Fund | null) => ({
  fund_id: defaultFund?.id ?? "",
  date: dayjs().format("YYYY-MM-DD"),
  amount: "",
  category_id: "",
  account_id: "",
  payment_method_id: "",
  merchant: "",
  notes: "",
  tags: "",
});

export const SpendFromFundModal = ({
  opened,
  onClose,
  funds,
  defaultFund = null,
  readOnly = false,
}: SpendFromFundModalProps) => {
  const [form, setForm] = useState(() => buildInitialForm(defaultFund));
  const [error, setError] = useState<string | null>(null);

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();

  const [addTransaction, { isLoading: isAddingTransaction }] =
    useAddTransactionMutation();
  const [addFundContribution, { isLoading: isAddingContribution }] =
    useAddFundContributionMutation();
  const [deleteTransaction] = useDeleteTransactionMutation();

  const fundMap = useMemo(() => new Map(funds.map((fund) => [fund.id, fund])), [funds]);
  const fundOptions = useMemo(
    () =>
      funds.map((fund) => ({
        value: fund.id,
        label: `${fund.name} · ${formatINR(fund.current_amount)} available`,
      })),
    [funds]
  );
  const categoryOptions = useMemo(
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
        label: `${account.name} · ${
          account.type === "card" ? "Credit card" : account.type
        }`,
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

  const selectedFund = form.fund_id ? fundMap.get(form.fund_id) : null;
  const parsedAmount = Number(form.amount);
  const remainingAfterSpend =
    selectedFund && !Number.isNaN(parsedAmount) ? selectedFund.current_amount - parsedAmount : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (readOnly) {
      setError("Demo mode is read-only. You can browse but not save changes.");
      return;
    }
    if (!form.fund_id) {
      setError("Select a fund.");
      return;
    }
    if (!form.category_id) {
      setError("Select an expense category.");
      return;
    }
    if (!form.account_id) {
      setError("Select the account used for this payment.");
      return;
    }
    if (!form.amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid spend amount.");
      return;
    }
    if (!form.date) {
      setError("Select a date.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Spend-from-fund needs internet because it updates two records.");
      return;
    }

    const fund = fundMap.get(form.fund_id);
    if (!fund || fund.is_archived) {
      setError("Select an active fund.");
      return;
    }
    if (parsedAmount - fund.current_amount > 0.01) {
      setError(
        `Spend exceeds fund balance. Available: ${formatINR(fund.current_amount)}.`
      );
      return;
    }

    const tags = form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const merchant = form.merchant.trim() ? form.merchant.trim() : null;
    const userNote = form.notes.trim() ? form.notes.trim() : null;
    const transactionNote = userNote
      ? `[Fund spend: ${fund.name}] ${userNote}`
      : `[Fund spend: ${fund.name}]`;
    const contributionNote = merchant
      ? `Spent via ${merchant}`
      : userNote
      ? userNote
      : "Spent for goal";

    let createdTransactionId: string | null = null;

    try {
      const created = await addTransaction({
        type: "expense",
        date: form.date,
        amount: parsedAmount,
        category_id: form.category_id,
        reimbursement_category_id: null,
        reimbursement_of_transaction_id: null,
        payment_method_id: form.payment_method_id || null,
        account_id: form.account_id,
        merchant,
        notes: transactionNote,
        tags,
        is_transfer: false,
        is_recurring: false,
        is_reimbursement: false,
        is_shared: false,
        offlineQueue: "disallow",
      }).unwrap();
      createdTransactionId = created.id;

      await addFundContribution({
        fund_id: form.fund_id,
        date: form.date,
        amount: -parsedAmount,
        note: contributionNote,
      }).unwrap();

      onClose();
    } catch {
      if (createdTransactionId) {
        try {
          await deleteTransaction({ id: createdTransactionId }).unwrap();
          setError("Unable to complete spend-from-fund. No changes were saved.");
          return;
        } catch {
          setError(
            "Expense was created but fund withdrawal failed. Please delete the expense and retry."
          );
          return;
        }
      }
      setError("Unable to save spend-from-fund.");
    }
  };

  const isSaving = isAddingTransaction || isAddingContribution;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Spend from fund"
      size="lg"
    >
      <Stack component="form" gap="sm" onSubmit={handleSubmit}>
        <Text size="sm" c="dimmed">
          This posts two linked effects: one expense transaction and one fund
          withdrawal.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Fund"
            data={fundOptions}
            value={form.fund_id || null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, fund_id: value ?? "" }))
            }
            placeholder="Choose fund"
            searchable
            required
          />
          <DateInput
            label="Date"
            value={form.date ? dayjs(form.date).toDate() : null}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                date: value ? dayjs(value).format("YYYY-MM-DD") : "",
              }))
            }
            required
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Amount"
            type="number"
            value={form.amount}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, amount: event.target.value }))
            }
            placeholder="0"
            min="0"
            step="0.01"
            required
          />
          <Select
            label="Category"
            data={categoryOptions}
            value={form.category_id || null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, category_id: value ?? "" }))
            }
            searchable
            required
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Account"
            data={accountOptions}
            value={form.account_id || null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, account_id: value ?? "" }))
            }
            searchable
            required
          />
          <Select
            label="Payment method"
            data={paymentOptions}
            value={form.payment_method_id || null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, payment_method_id: value ?? "" }))
            }
            searchable
            clearable
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Merchant / payee / place"
            value={form.merchant}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, merchant: event.target.value }))
            }
            placeholder="Optional"
          />
          <TextInput
            label="Tags"
            value={form.tags}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, tags: event.target.value }))
            }
            placeholder="car, down-payment"
          />
        </SimpleGrid>
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, notes: event.target.value }))
          }
          placeholder="Optional context"
          minRows={2}
        />
        {selectedFund ? (
          <Text size="xs" c={remainingAfterSpend !== null && remainingAfterSpend < 0 ? "red.6" : "dimmed"}>
            Available in fund: {formatINR(selectedFund.current_amount)}
            {remainingAfterSpend !== null && !Number.isNaN(remainingAfterSpend)
              ? ` · After spend: ${formatINR(Math.max(remainingAfterSpend, 0))}`
              : ""}
          </Text>
        ) : null}
        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" color="green" loading={isSaving} disabled={readOnly}>
            Save spend
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
