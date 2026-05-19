import {
  Alert,
  Accordion,
  Autocomplete,
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
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import dayjs from "dayjs";
import {
  useAddSubscriptionMutation,
  useDeleteSubscriptionMutation,
  useUpdateSubscriptionMutation,
} from "../../features/api/apiSlice";
import { getBaseCurrency } from "../../lib/moneyConfig";
import { formatINR } from "../../lib/format";
import type {
  Account,
  Category,
  PaymentMethod,
  Subscription,
} from "../../types/finance";

type SubscriptionFormModalProps = {
  opened: boolean;
  onClose: () => void;
  subscription?: Subscription | null;
  categories: Category[];
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  readOnly?: boolean;
};

const cadenceOptions = [
  { value: "1", label: "Monthly" },
  { value: "3", label: "Quarterly" },
  { value: "6", label: "Half-yearly" },
  { value: "12", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const currencyOptions = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CNY",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "ZAR",
  "KES",
  "NGN",
  "AED",
  "SGD",
];

const buildInitialForm = (subscription?: Subscription | null) => {
  const interval = subscription?.interval_months ?? 1;
  const match = ["1", "3", "6", "12"].includes(String(interval));
  const baseCurrency = getBaseCurrency();
  return {
    name: subscription?.name ?? "",
    amount: subscription ? String(subscription.amount) : "",
    currency: subscription?.currency ?? baseCurrency,
    estimated_base_amount: subscription
      ? String(subscription.estimated_base_amount)
      : "",
    cadence: match ? String(interval) : "custom",
    custom_interval: match ? "" : String(interval),
    billing_anchor: subscription?.billing_anchor ?? "",
    next_due: subscription?.next_due ?? "",
    status: subscription?.status ?? "active",
    category_id: subscription?.category_id ?? "",
    account_id: subscription?.account_id ?? "",
    payment_method_id: subscription?.payment_method_id ?? "",
    notes: subscription?.notes ?? "",
  };
};

const computeNextDueDate = (anchor: string, intervalMonths: number) => {
  if (!anchor || !Number.isFinite(intervalMonths) || intervalMonths <= 0) {
    return "";
  }
  const anchorDate = dayjs(anchor);
  if (!anchorDate.isValid()) {
    return "";
  }
  const today = dayjs().startOf("day");
  if (anchorDate.isAfter(today, "day") || anchorDate.isSame(today, "day")) {
    return anchorDate.format("YYYY-MM-DD");
  }
  const monthsDiff = today.diff(anchorDate, "month", true);
  const cycles = Math.max(1, Math.ceil(monthsDiff / intervalMonths));
  return anchorDate.add(cycles * intervalMonths, "month").format("YYYY-MM-DD");
};

export const SubscriptionFormModal = ({
  opened,
  onClose,
  subscription,
  categories,
  accounts,
  paymentMethods,
  readOnly = false,
}: SubscriptionFormModalProps) => {
  const [form, setForm] = useState(() => buildInitialForm(subscription));
  const [isNextDueManual, setIsNextDueManual] = useState(
    () => Boolean(subscription?.next_due)
  );
  const [error, setError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [addSubscription, { isLoading: isSaving }] =
    useAddSubscriptionMutation();
  const [updateSubscription, { isLoading: isUpdating }] =
    useUpdateSubscriptionMutation();
  const [deleteSubscription, { isLoading: isDeleting }] =
    useDeleteSubscriptionMutation();

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
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

  const cadenceValue = form.cadence || "1";
  const intervalMonths =
    cadenceValue === "custom"
      ? Number(form.custom_interval)
      : Number(cadenceValue);
  const autoNextDue = useMemo(
    () => computeNextDueDate(form.billing_anchor, intervalMonths),
    [form.billing_anchor, intervalMonths]
  );
  const nextDueValue = isNextDueManual ? form.next_due : autoNextDue;
  const nextDuePreview = useMemo(() => {
    if (!nextDueValue) {
      return null;
    }
    return dayjs(nextDueValue).format("DD MMM YYYY");
  }, [nextDueValue]);
  const baseCurrency = getBaseCurrency();
  const normalizedCurrency = (form.currency || baseCurrency).toUpperCase();
  const isForeignCurrency = normalizedCurrency !== baseCurrency;
  const shouldShowAdvanced =
    Boolean(form.notes.trim()) ||
    Boolean(form.payment_method_id) ||
    form.status !== "active";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (readOnly) {
      return;
    }

    if (!form.name.trim()) {
      setError("Enter a subscription name.");
      return;
    }

    if (!form.amount || Number.isNaN(Number(form.amount))) {
      setError("Enter a valid amount.");
      return;
    }

    if (!normalizedCurrency.trim()) {
      setError("Enter a currency code.");
      return;
    }

    const resolvedNextDue = isNextDueManual ? form.next_due : autoNextDue;
    if (!resolvedNextDue) {
      setError("Choose the next due date.");
      return;
    }

    if (!intervalMonths || Number.isNaN(intervalMonths) || intervalMonths <= 0) {
      setError("Enter a valid billing cadence.");
      return;
    }

    const estimatedBaseAmount =
      normalizedCurrency === baseCurrency
        ? Number(form.amount)
        : Number(form.estimated_base_amount);

    if (!Number.isFinite(estimatedBaseAmount) || estimatedBaseAmount < 0) {
      setError(`Enter a valid estimated ${baseCurrency} amount.`);
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        amount: Number(form.amount),
        currency: normalizedCurrency,
        estimated_base_amount: estimatedBaseAmount,
        interval_months: intervalMonths,
        billing_anchor: form.billing_anchor || resolvedNextDue,
        next_due: resolvedNextDue,
        last_paid: subscription?.last_paid ?? null,
        last_billed_base_amount: subscription?.last_billed_base_amount ?? null,
        last_fx_rate: subscription?.last_fx_rate ?? null,
        status: form.status,
        category_id: form.category_id || null,
        account_id: form.account_id || null,
        payment_method_id: form.payment_method_id || null,
        notes: form.notes.trim() ? form.notes.trim() : null,
      };

      if (subscription?.id) {
        await updateSubscription({ id: subscription.id, ...payload }).unwrap();
      } else {
        await addSubscription(payload).unwrap();
      }

      onClose();
    } catch {
      setError(
        subscription?.id
          ? "Unable to update the subscription."
          : "Unable to save the subscription."
      );
    }
  };

  const handleOpenDelete = () => {
    if (!subscription) {
      return;
    }
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!subscription) {
      return;
    }
    if (readOnly) {
      return;
    }

    try {
      await deleteSubscription({ id: subscription.id }).unwrap();
      setIsDeleteOpen(false);
      onClose();
    } catch {
      setDeleteError("Unable to delete the subscription.");
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={subscription?.id ? "Edit subscription" : "Create subscription"}
        size="lg"
      >
        <Stack component="form" gap="sm" onSubmit={handleSubmit}>
          <TextInput
            label="Subscription name"
            placeholder="Netflix, Spotify, Office 365"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            required
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Native amount"
              type="number"
              value={form.amount}
              onChange={(event) =>
                setForm((prev) => {
                  const nextAmount = event.target.value;
                    return {
                      ...prev,
                      amount: nextAmount,
                      estimated_base_amount:
                        (prev.currency || baseCurrency).toUpperCase() === baseCurrency
                          ? nextAmount
                          : prev.estimated_base_amount,
                    };
                })
              }
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
            <Autocomplete
              label="Currency"
              data={currencyOptions}
              value={normalizedCurrency}
              onChange={(value) =>
                setForm((prev) => {
                  const nextCurrency = (value || baseCurrency).toUpperCase();
                  return {
                    ...prev,
                    currency: nextCurrency,
                    estimated_base_amount:
                      nextCurrency === baseCurrency
                        ? prev.amount
                        : prev.estimated_base_amount,
                  };
                })
              }
              placeholder="e.g. USD"
              required
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label={`Estimated ${baseCurrency} charge`}
              type="number"
              value={
                normalizedCurrency === baseCurrency
                  ? form.amount
                  : form.estimated_base_amount
              }
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  estimated_base_amount: event.target.value,
                }))
              }
              placeholder="0"
              min="0"
              step="0.01"
              disabled={normalizedCurrency === baseCurrency}
              required
            />
            <Select
              label="Billing cadence"
              value={cadenceValue}
              onChange={(value) => {
                setForm((prev) => ({ ...prev, cadence: value || "1" }));
                setIsNextDueManual(false);
              }}
              data={cadenceOptions}
              required
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            {isForeignCurrency
              ? `Use this ${baseCurrency} estimate for planning cards, cashflow, and bill totals. You can enter the actual ${baseCurrency} debit when you post the payment.`
              : `${baseCurrency} subscriptions use the native amount directly for planning and posting.`}
          </Text>
          {cadenceValue === "custom" ? (
            <TextInput
              label="Repeat every (months)"
              type="number"
              value={form.custom_interval}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  custom_interval: event.target.value,
                }));
                setIsNextDueManual(false);
              }}
              placeholder="e.g. 2"
              min="1"
              step="1"
              required
            />
          ) : null}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <DateInput
              label="First billed on"
              value={form.billing_anchor ? new Date(form.billing_anchor) : null}
              onChange={(value) => {
                setForm((prev) => ({
                  ...prev,
                  billing_anchor: value
                    ? new Date(value).toISOString().slice(0, 10)
                    : "",
                }));
                setIsNextDueManual(false);
              }}
              clearable
            />
            <DateInput
              label="Next due date"
              value={nextDueValue ? new Date(nextDueValue) : null}
              onChange={(value) => {
                setForm((prev) => ({
                  ...prev,
                  next_due: value
                    ? new Date(value).toISOString().slice(0, 10)
                    : "",
                }));
                if (value) {
                  setIsNextDueManual(true);
                }
              }}
              clearable={false}
              required
            />
          </SimpleGrid>
          {nextDuePreview ? (
            <Text size="xs" c="dimmed">
              Next charge on {nextDuePreview}
              {!isNextDueManual ? " (auto)" : ""}
            </Text>
          ) : null}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Category"
              data={categoryOptions}
              value={form.category_id}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, category_id: value ?? "" }))
              }
              searchable
              clearable
            />
            <Select
              label="Account"
              data={accountOptions}
              value={form.account_id}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, account_id: value ?? "" }))
              }
              searchable
              clearable
            />
          </SimpleGrid>
          <Accordion
            variant="separated"
            radius="md"
            defaultValue={shouldShowAdvanced ? "advanced" : undefined}
          >
            <Accordion.Item value="advanced">
              <Accordion.Control>Advanced options</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <Select
                      label="Payment method"
                      data={paymentOptions}
                      value={form.payment_method_id}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          payment_method_id: value ?? "",
                        }))
                      }
                      searchable
                      clearable
                    />
                    <Select
                      label="Status"
                      data={[
                        { value: "active", label: "Active" },
                        { value: "paused", label: "Paused" },
                        { value: "cancelled", label: "Cancelled" },
                      ]}
                      value={form.status}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          status: (value ?? "active") as Subscription["status"],
                        }))
                      }
                      required
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
                  {subscription?.last_billed_base_amount ? (
                    <Text size="xs" c="dimmed">
                      Last billed at {formatINR(subscription.last_billed_base_amount)}
                      {subscription.last_fx_rate
                        ? ` · FX ${subscription.last_fx_rate.toFixed(4)}`
                        : ""}
                    </Text>
                  ) : null}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          {error ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}
          <Group justify="space-between" align="center">
            {subscription?.id ? (
              <Button
                variant="subtle"
                color="red"
                onClick={handleOpenDelete}
                disabled={readOnly}
              >
                Delete subscription
              </Button>
            ) : (
              <div />
            )}
            <Group>
              <Button variant="subtle" color="gray" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSaving || isUpdating}
                color="green"
                disabled={readOnly}
              >
                {subscription?.id ? "Update subscription" : "Save subscription"}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete subscription"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">
            This will remove the subscription and stop it from showing up in
            upcoming renewals.
          </Text>
          {deleteError ? (
            <Alert color="red" variant="light">
              {deleteError}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setIsDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={isDeleting}
              onClick={handleConfirmDelete}
              disabled={readOnly}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
