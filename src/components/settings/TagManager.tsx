import {
  ActionIcon,
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { Pencil, Plus, Trash } from "lucide-react";
import {
  useAddTagMutation,
  useDeleteTagMutation,
  useGetTagsQuery,
  useUpdateTagMutation,
} from "../../features/api/apiSlice";
import type { Tag } from "../../types/finance";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { SectionCard } from "./SectionCard";
import { useReadOnly } from "../../context/ReadOnlyContext";

export const TagManager = () => {
  const { data: tags = [] } = useGetTagsQuery();
  const isReadOnly = useReadOnly();
  const [addTag, { isLoading: isSaving }] = useAddTagMutation();
  const [updateTag, { isLoading: isUpdating }] = useUpdateTagMutation();
  const [deleteTag, { isLoading: isDeleting }] = useDeleteTagMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setName("");
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setMode("edit");
    setEditing(tag);
    setName(tag.name);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (isReadOnly) {
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const payload = { name: name.trim() };
    try {
      if (mode === "edit" && editing) {
        await updateTag({ id: editing.id, ...payload }).unwrap();
      } else {
        await addTag(payload).unwrap();
      }
      setModalOpen(false);
    } catch {
      setError("Unable to save tag.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    if (isReadOnly) return;
    await deleteTag({ id: deleteId }).unwrap();
    setDeleteId(null);
  };

  return (
    <>
      <SectionCard
        title="Tags"
        description="Quick labels for search and filtering."
        badge={`${tags.length} total`}
      >
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            Example: groceries, work, reimbursable.
          </Text>
          <Button
            leftSection={<Plus size={16} strokeWidth={2} />}
            onClick={openCreate}
            disabled={isReadOnly}
          >
            New tag
          </Button>
        </Group>
        <ScrollArea h={200}>
          <Table horizontalSpacing="md" verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tags.map((tag) => (
                <Table.Tr key={tag.id}>
                  <Table.Td>{tag.name}</Table.Td>
                  <Table.Td width={120}>
                    <Group gap={6} justify="flex-end">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => openEdit(tag)}
                        aria-label="Edit tag"
                        disabled={isReadOnly}
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteId(tag.id)}
                        aria-label="Delete tag"
                        disabled={isReadOnly}
                      >
                        <Trash size={16} strokeWidth={2} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {tags.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={2}>
                    <Text size="sm" c="dimmed">
                      No tags yet.
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
        title={mode === "edit" ? "Edit tag" : "New tag"}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g., groceries"
            required
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
        title="Delete tag?"
        message="This removes the tag link from existing transactions."
      />
    </>
  );
};
