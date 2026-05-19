import { Alert, Button, Group, Modal, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useState } from "react";
import type { FormEvent } from "react";
import { useUpdateLoanPaymentMutation } from "../../features/api/apiSlice";
import { formatINR } from "../../lib/format";
import type { LoanPayment } from "../../types/finance";

type EditLoanPaymentModalProps = {
  opened: boolean;
  onClose: () => void;
  payment: LoanPayment | null;
  readOnly?: boolean;
};

const buildInitialForm = (payment: LoanPayment | null) => ({
  payment_date: payment?.payment_date ?? dayjs().format("YYYY-MM-DD"),
  amount_paid: payment ? String(payment.amount_paid) : "",
  note: payment?.note ?? "",
});

export const EditLoanPaymentModal = ({
  opened,
  onClose,
  payment,
  readOnly = false,
}: EditLoanPaymentModalProps) => {
  const [form, setForm] = useState(() => buildInitialForm(payment));
  const [error, setError] = useState<string | null>(null);
  const [updateLoanPayment, { isLoading }] = useUpdateLoanPaymentMutation();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (readOnly) {
      setError("Demo mode is read-only. Changes are disabled.");
      return;
    }
    if (!payment) {
      setError("Missing payment context.");
      return;
    }
    const amountPaid = Number(form.amount_paid);
    if (!amountPaid || Number.isNaN(amountPaid) || amountPaid <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    if (!form.payment_date) {
      setError("Select a payment date.");
      return;
    }

    try {
      await updateLoanPayment({
        id: payment.id,
        payment_date: form.payment_date,
        amount_paid: amountPaid,
        note: form.note.trim() ? form.note.trim() : null,
      }).unwrap();
      onClose();
    } catch {
      setError("Unable to update loan payment.");
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Edit loan payment" size="md">
      <Stack component="form" gap="sm" onSubmit={handleSubmit}>
        <Alert color="blue" variant="light">
          <Text size="sm" fw={600}>
            {payment?.loan_name ?? "Loan"} payment
          </Text>
          <Text size="xs">
            Existing amount {formatINR(payment?.amount_paid ?? 0)} · Method{" "}
            {payment?.method ?? "-"}
          </Text>
          <Text size="xs">This updates the same record and linked transaction.</Text>
        </Alert>
        <DateInput
          label="Payment date"
          value={form.payment_date ? dayjs(form.payment_date).toDate() : null}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              payment_date: value ? dayjs(value).format("YYYY-MM-DD") : "",
            }))
          }
          required
        />
        <TextInput
          label="Amount paid"
          type="number"
          value={form.amount_paid}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, amount_paid: event.target.value }))
          }
          min="0"
          step="0.01"
          required
        />
        <Textarea
          label="Note"
          value={form.note}
          onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          minRows={2}
          placeholder="Optional payment note"
        />
        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" color="green" loading={isLoading} disabled={readOnly}>
            Save changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
