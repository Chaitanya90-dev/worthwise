import {
  ActionIcon,
  Button,
  Group,
  Divider,
  NumberInput,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash } from "lucide-react";
import {
  useAddRuleMutation,
  useGetAccountsQuery,
  useDeleteRuleMutation,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetRulesQuery,
  useGetTransactionsByRangeQuery,
  useUpdateRuleMutation,
} from "../../features/api/apiSlice";
import type { TransactionRule } from "../../types/finance";
import { SectionCard } from "./SectionCard";
import { previewRules } from "../../lib/rules";
import { RuleImpactPreview } from "./RuleImpactPreview";

const MATCH_TYPES = [
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts with" },
  { value: "equals", label: "Equals" },
  { value: "ends_with", label: "Ends with" },
  { value: "regex", label: "Regex" },
];

const TRANSACTION_TYPES = [
  { value: "any", label: "Any" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

const buildInitialForm = (rule?: TransactionRule | null) => ({
  name: rule?.name ?? "",
  match_text: rule?.match_text ?? "",
  match_type: rule?.match_type ?? "contains",
  transaction_type: rule?.transaction_type ?? "any",
  category_id: rule?.category_id ?? "",
  account_id: rule?.account_id ?? "",
  payment_method_id: rule?.payment_method_id ?? "",
  tag_names: rule?.tag_names?.join(", ") ?? "",
  is_active: rule?.is_active ?? true,
  priority: rule?.priority ?? 100,
  new_merchant_name: rule?.new_merchant_name ?? "",
});

export const RuleManager = () => {
  const { data: rules = [] } = useGetRulesQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const [addRule, { isLoading: isSaving }] = useAddRuleMutation();
  const [updateRule, { isLoading: isUpdating }] = useUpdateRuleMutation();
  const [deleteRule, { isLoading: isDeleting }] = useDeleteRuleMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRule | null>(null);
  const [form, setForm] = useState(() => buildInitialForm(null));
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testText, setTestText] = useState("");
  const [testType, setTestType] = useState<"expense" | "income">("expense");
  const [testCategoryId, setTestCategoryId] = useState("");
  const [testAccountId, setTestAccountId] = useState("");
  const [testPaymentMethodId, setTestPaymentMethodId] = useState("");
  const [testTags, setTestTags] = useState("");

  const previewStart = dayjs().subtract(90, "day").format("YYYY-MM-DD");
  const previewEnd = dayjs().format("YYYY-MM-DD");
  const { data: previewTransactions = [] } = useGetTransactionsByRangeQuery(
    { start: previewStart, end: previewEnd },
    { skip: !modalOpen },
  );

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name,
      })),
    [accounts],
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );

  const paymentOptions = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method.id,
        label: method.name,
      })),
    [paymentMethods],
  );

  const paymentMap = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods],
  );

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(buildInitialForm(null));
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (rule: TransactionRule) => {
    setEditing(rule);
    setForm(buildInitialForm(rule));
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!form.match_text.trim()) {
      setError("Match text is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      match_text: form.match_text.trim(),
      match_type: form.match_type as TransactionRule["match_type"],
      transaction_type:
        form.transaction_type as TransactionRule["transaction_type"],
      category_id: form.category_id || null,
      account_id: form.account_id || null,
      payment_method_id: form.payment_method_id || null,
      tag_names: draftTags,
      is_active: form.is_active,
      priority: Number(form.priority) || 100,
      new_merchant_name: form.new_merchant_name.trim() || null,
    };

    try {
      if (editing) {
        await updateRule({ id: editing.id, ...payload }).unwrap();
      } else {
        await addRule(payload).unwrap();
      }
      setModalOpen(false);
    } catch {
      setError("Unable to save rule.");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) {
      return;
    }
    await deleteRule({ id: deleteId }).unwrap();
    setDeleteId(null);
  };

  const handleToggle = async (rule: TransactionRule) => {
    await updateRule({ ...rule, is_active: !rule.is_active }).unwrap();
  };

  const handleAdjustPriority = async (rule: TransactionRule, delta: number) => {
    const nextPriority = Math.max(1, rule.priority + delta);
    await updateRule({ ...rule, priority: nextPriority }).unwrap();
  };

  const testResult = useMemo(() => {
    const tags = testTags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    return previewRules(
      {
        notes: testText.trim() ? testText.trim() : null,
        type: testType,
        category_id: testCategoryId || null,
        account_id: testAccountId || null,
        payment_method_id: testPaymentMethodId || null,
        tags,
      },
      sortedRules,
    );
  }, [
    sortedRules,
    testCategoryId,
    testAccountId,
    testPaymentMethodId,
    testTags,
    testText,
    testType,
  ]);

  const testCategoryLabel = testResult.category_id
    ? (categoryMap.get(testResult.category_id) ?? "Unknown")
    : "No category";
  const testAccountLabel = testResult.account_id
    ? (accountMap.get(testResult.account_id) ?? "Unknown")
    : "No account";
  const testPaymentLabel = testResult.payment_method_id
    ? (paymentMap.get(testResult.payment_method_id) ?? "Unknown")
    : "No payment";

  const draftTags = form.tag_names
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const draftRule: TransactionRule = {
    id: editing?.id ?? "draft",
    name: form.name.trim() || "Draft rule",
    match_text: form.match_text.trim(),
    match_type: form.match_type as TransactionRule["match_type"],
    transaction_type:
      form.transaction_type as TransactionRule["transaction_type"],
    category_id: form.category_id || null,
    account_id: form.account_id || null,
    payment_method_id: form.payment_method_id || null,
    tag_names: draftTags,
    is_active: form.is_active,
    priority: Number(form.priority) || 100,
    new_merchant_name: form.new_merchant_name.trim() || null,
  };

  return (
    <>
      <SectionCard
        title="Rules"
        description="Auto-categorize and tag transactions based on keywords."
        badge={`${rules.length} rules`}
      >
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            Rules match on merchant/notes and can apply category, account,
            payment method, and tags.
          </Text>
          <Button
            onClick={openCreate}
            leftSection={<Plus size={16} strokeWidth={2} />}
          >
            New rule
          </Button>
        </Group>
        <Table horizontalSpacing="md" verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Rule</Table.Th>
              <Table.Th>Match</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Account</Table.Th>
              <Table.Th>Payment</Table.Th>
              <Table.Th>Tags</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedRules.map((rule) => (
              <Table.Tr key={rule.id}>
                <Table.Td>{rule.name}</Table.Td>
                <Table.Td>
                  {rule.match_type.replace("_", " ")} “{rule.match_text}”
                </Table.Td>
                <Table.Td>{rule.transaction_type}</Table.Td>
                <Table.Td>
                  {rule.category_id
                    ? (categoryMap.get(rule.category_id) ?? "Unknown")
                    : "-"}
                </Table.Td>
                <Table.Td>
                  {rule.account_id
                    ? (accountMap.get(rule.account_id) ?? "Unknown")
                    : "-"}
                </Table.Td>
                <Table.Td>
                  {rule.payment_method_id
                    ? (paymentMap.get(rule.payment_method_id) ?? "Unknown")
                    : "-"}
                </Table.Td>
                <Table.Td>
                  {rule.tag_names.length > 0 ? rule.tag_names.join(", ") : "-"}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => handleAdjustPriority(rule, -10)}
                      aria-label="Increase priority"
                    >
                      <ArrowUp size={14} strokeWidth={2} />
                    </ActionIcon>
                    <Text size="sm">{rule.priority}</Text>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => handleAdjustPriority(rule, 10)}
                      aria-label="Decrease priority"
                    >
                      <ArrowDown size={14} strokeWidth={2} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Switch
                    size="sm"
                    checked={rule.is_active}
                    onChange={() => handleToggle(rule)}
                    aria-label={`Toggle ${rule.name}`}
                  />
                </Table.Td>
                <Table.Td width={120}>
                  <Group gap={6} justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => openEdit(rule)}
                      aria-label="Edit rule"
                    >
                      <Pencil size={16} strokeWidth={2} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => setDeleteId(rule.id)}
                      aria-label="Delete rule"
                    >
                      <Trash size={16} strokeWidth={2} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {rules.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={10}>
                  <Text size="sm" c="dimmed">
                    No rules yet. Create one to auto-categorize transactions.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
        <Paper withBorder radius="md" p="md" mt="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>Test rules</Text>
              <Text size="xs" c="dimmed">
                {testResult.matchedRules?.length ?? 0} matched
              </Text>
            </Group>
            <SimpleGrid cols={{ base: 1, md: 5 }} spacing="sm">
              <Textarea
                label="Sample description"
                value={testText}
                onChange={(event) => setTestText(event.target.value)}
                placeholder="e.g., NETFLIX.COM, ZOMATO"
                minRows={2}
              />
              <Select
                label="Transaction type"
                data={[
                  { value: "expense", label: "Expense" },
                  { value: "income", label: "Income" },
                ]}
                value={testType}
                onChange={(value) =>
                  setTestType((value ?? "expense") as "expense" | "income")
                }
              />
              <Select
                label="Existing category (optional)"
                data={categoryOptions}
                value={testCategoryId || null}
                onChange={(value) => setTestCategoryId(value ?? "")}
                clearable
                searchable
              />
              <Select
                label="Existing account (optional)"
                data={accountOptions}
                value={testAccountId || null}
                onChange={(value) => setTestAccountId(value ?? "")}
                clearable
                searchable
              />
              <Select
                label="Existing payment (optional)"
                data={paymentOptions}
                value={testPaymentMethodId || null}
                onChange={(value) => setTestPaymentMethodId(value ?? "")}
                clearable
                searchable
              />
            </SimpleGrid>
            <TextInput
              label="Existing tags (comma separated)"
              value={testTags}
              onChange={(event) => setTestTags(event.target.value)}
              placeholder="groceries, subscription"
            />
            <Group justify="space-between" align="center" wrap="wrap">
              <Stack gap={2}>
                <Text size="sm" c="dimmed">
                  Result category
                </Text>
                <Text fw={600}>{testCategoryLabel}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="sm" c="dimmed">
                  Result account
                </Text>
                <Text fw={600}>{testAccountLabel}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="sm" c="dimmed">
                  Result payment
                </Text>
                <Text fw={600}>{testPaymentLabel}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="sm" c="dimmed">
                  Result tags
                </Text>
                <Text fw={600}>
                  {testResult.tags.length > 0
                    ? testResult.tags.join(", ")
                    : "No tags"}
                </Text>
              </Stack>
            </Group>
            {testResult.matchedRules && testResult.matchedRules.length > 0 ? (
              <Stack gap={6}>
                <Text size="sm" c="dimmed">
                  Matched rules (by priority)
                </Text>
                {testResult.matchedRules.map((rule) => (
                  <Group key={rule.id} justify="space-between">
                    <Text size="sm">{rule.name}</Text>
                    <Text size="xs" c="dimmed">
                      Priority {rule.priority}
                    </Text>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                No rules matched this text.
              </Text>
            )}
          </Stack>
        </Paper>
      </SectionCard>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit rule" : "New rule"}
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Rule name"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            required
          />
          <Group grow>
            <Select
              label="Match type"
              data={MATCH_TYPES}
              value={form.match_type}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  match_type: (value ??
                    "contains") as TransactionRule["match_type"],
                }))
              }
              required
            />
            <Select
              label="Transaction type"
              data={TRANSACTION_TYPES}
              value={form.transaction_type}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  transaction_type: (value ??
                    "any") as TransactionRule["transaction_type"],
                }))
              }
              required
            />
          </Group>
          <TextInput
            label="Match text"
            placeholder={
              form.match_type === "regex"
                ? "e.g., ^zomato"
                : "e.g., netflix, zomato"
            }
            value={form.match_text}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, match_text: event.target.value }))
            }
            required
          />
          <TextInput
            label="Rename merchant to (optional)"
            placeholder="e.g., Netflix"
            value={form.new_merchant_name}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                new_merchant_name: event.target.value,
              }))
            }
          />
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <Select
              label="Category"
              data={categoryOptions}
              value={form.category_id || null}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, category_id: value ?? "" }))
              }
              searchable
              clearable
            />
            <Select
              label="Account (optional)"
              data={accountOptions}
              value={form.account_id || null}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, account_id: value ?? "" }))
              }
              searchable
              clearable
            />
            <Select
              label="Payment method (optional)"
              data={paymentOptions}
              value={form.payment_method_id || null}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, payment_method_id: value ?? "" }))
              }
              searchable
              clearable
            />
          </SimpleGrid>
          <TextInput
            label="Tags (comma separated)"
            placeholder="subscription, entertainment"
            value={form.tag_names}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, tag_names: event.target.value }))
            }
          />
          <NumberInput
            label="Priority"
            value={form.priority}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                priority: typeof value === "number" ? value : prev.priority,
              }))
            }
            min={1}
            step={10}
          />
          <Switch
            label="Active"
            checked={form.is_active}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                is_active: event.currentTarget.checked,
              }))
            }
          />
          <Divider />
          <RuleImpactPreview
            draftRule={draftRule}
            rules={sortedRules}
            transactions={previewTransactions}
            categoryMap={categoryMap}
          />
          {error ? (
            <Text size="sm" c="red">
              {error}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              loading={isSaving || isUpdating}
              onClick={handleSave}
              color="green"
            >
              {editing ? "Save changes" : "Create rule"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Delete rule?"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">This rule will no longer auto-tag transactions.</Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setDeleteId(null)}
            >
              Cancel
            </Button>
            <Button color="red" loading={isDeleting} onClick={handleDelete}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
