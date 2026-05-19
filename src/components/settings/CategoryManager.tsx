import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash } from "lucide-react";
import {
  useAddCategoryMutation,
  useDeleteCategoryMutation,
  useGetCategoriesQuery,
  useUpdateCategoryMutation,
} from "../../features/api/apiSlice";
import type { Category } from "../../types/finance";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { SectionCard } from "./SectionCard";
import { useReadOnly } from "../../context/ReadOnlyContext";

type FormState = {
  name: string;
  type: "expense" | "income";
  parent_id: string | null;
};

export const CategoryManager = () => {
  const { data: categories = [] } = useGetCategoriesQuery();
  const isReadOnly = useReadOnly();
  const [addCategory, { isLoading: isSaving }] = useAddCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] =
    useUpdateCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] =
    useDeleteCategoryMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    type: "expense",
    parent_id: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const parentOptions = useMemo(
    () =>
      categories
        .filter(
          (cat) =>
            cat.type === form.type &&
            (!editing || cat.id !== editing.id) &&
            cat.parent_id !== editing?.id
        )
        .map((cat) => ({
          value: cat.id,
          label: cat.name,
        })),
    [categories, form.type, editing]
  );

  const resetForm = () => {
    setForm({ name: "", type: "expense", parent_id: null });
    setError(null);
  };

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setMode("edit");
    setEditing(category);
    setForm({
      name: category.name,
      type: category.type,
      parent_id: category.parent_id,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (isReadOnly) {
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      parent_id: form.parent_id,
    };
    try {
      if (mode === "edit" && editing) {
        await updateCategory({ id: editing.id, ...payload }).unwrap();
      } else {
        await addCategory(payload).unwrap();
      }
      setModalOpen(false);
      resetForm();
    } catch {
      setError("Unable to save category.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    if (isReadOnly) return;
    await deleteCategory({ id: deleteId }).unwrap();
    setDeleteId(null);
  };

  return (
    <>
      <SectionCard
        title="Categories"
        description="Manage income and expense categories, including parent/child nesting."
        badge={`${categories.length} total`}
      >
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            Use parents for grouping (e.g., Food &gt; Eating Out).
          </Text>
          <Button
            leftSection={<Plus size={16} strokeWidth={2} />}
            onClick={openCreate}
            disabled={isReadOnly}
          >
            New category
          </Button>
        </Group>
        <ScrollArea h={260}>
          <Table
            horizontalSpacing="md"
            verticalSpacing="sm"
            striped
            highlightOnHover
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Parent</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {categories.map((category) => (
                <Table.Tr key={category.id}>
                  <Table.Td>{category.name}</Table.Td>
                  <Table.Td>
                    <Badge
                      variant="light"
                      color={category.type === "expense" ? "red" : "teal"}
                    >
                      {category.type}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {category.parent_id
                      ? categories.find((c) => c.id === category.parent_id)
                          ?.name ?? "-"
                      : "-"}
                  </Table.Td>
                  <Table.Td width={120}>
                    <Group gap={6} justify="flex-end">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => openEdit(category)}
                        aria-label="Edit category"
                        disabled={isReadOnly}
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteId(category.id)}
                        aria-label="Delete category"
                        disabled={isReadOnly}
                      >
                        <Trash size={16} strokeWidth={2} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {categories.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="sm" c="dimmed">
                      No categories yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </SectionCard>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mode === "edit" ? "Edit category" : "New category"}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="e.g., Groceries"
            required
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Type"
              data={[
                { value: "expense", label: "Expense" },
                { value: "income", label: "Income" },
              ]}
              value={form.type}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  type: (value as "expense" | "income") ?? "expense",
                  parent_id: null,
                }))
              }
            />
            <Select
              label="Parent (optional)"
              data={parentOptions}
              value={form.parent_id}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, parent_id: value ?? null }))
              }
              clearable
            />
          </SimpleGrid>
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
              onClick={handleSave}
              loading={isSaving || isUpdating}
              color="green"
              disabled={isReadOnly}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDeleteModal
        opened={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Delete category?"
        message="This will remove the category reference. Existing transactions will become uncategorized."
      />
    </>
  );
};
