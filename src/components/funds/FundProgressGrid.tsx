import { ActionIcon, Badge, Group, Paper, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import dayjs from "dayjs";
import type { Fund } from "../../types/finance";
import { formatINR } from "../../lib/format";
import { Archive, ArchiveRestore, HandCoins, Pencil, Trash } from "lucide-react";

type FundProgressGridProps = {
  funds: Fund[];
  onEdit: (fund: Fund) => void;
  onDelete: (fund: Fund) => void;
  onArchive: (fund: Fund) => void;
  onUnarchive: (fund: Fund) => void;
  onSpend: (fund: Fund) => void;
  archivingFundId?: string | null;
  readOnly?: boolean;
};

export const FundProgressGrid = ({
  funds,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  onSpend,
  archivingFundId = null,
  readOnly = false,
}: FundProgressGridProps) => {
  if (funds.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Create your first fund to start tracking progress.
      </Text>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      {funds.map((fund) => {
        const progress =
          fund.target_amount > 0
            ? Math.max(
                0,
                Math.min(100, (fund.current_amount / fund.target_amount) * 100)
              )
            : 0;
        const isGoalMet = progress >= 100;
        const remaining = fund.target_amount - fund.current_amount;
        const typeLabel = fund.type || "Goal";
        const isArchiving = archivingFundId === fund.id;

        return (
          <Paper
            key={fund.id}
            withBorder
            radius="md"
            p="md"
            style={{
              opacity: fund.is_archived ? 0.8 : 1,
              backgroundColor: fund.is_archived ? "var(--mantine-color-gray-0)" : undefined,
            }}
          >
            <Group justify="space-between" align="center" mb="xs">
              <Stack gap={2}>
                <Text fw={600}>{fund.name}</Text>
                <Text size="xs" c="dimmed">
                  {typeLabel}
                </Text>
              </Stack>
              <Group gap="xs">
                <Badge
                  variant="light"
                  color={fund.is_archived ? "gray" : "blue"}
                >
                  {Math.round(progress)}%
                </Badge>
                {fund.is_archived ? (
                  <Badge variant="light" color="gray">
                    Archived
                  </Badge>
                ) : null}
                {fund.is_archived ? (
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Unarchive ${fund.name}`}
                    onClick={() => onUnarchive(fund)}
                    disabled={readOnly || isArchiving}
                    loading={isArchiving}
                  >
                    <ArchiveRestore size={16} strokeWidth={2} />
                  </ActionIcon>
                ) : (
                  <ActionIcon
                    variant="subtle"
                    color="teal"
                    aria-label={`Spend from ${fund.name}`}
                    onClick={() => onSpend(fund)}
                    disabled={readOnly}
                  >
                    <HandCoins size={16} strokeWidth={2} />
                  </ActionIcon>
                )}
                {fund.is_archived ? null : (
                  <ActionIcon
                    variant="subtle"
                    color={isGoalMet ? "orange" : "gray"}
                    aria-label={`Archive ${fund.name}`}
                    onClick={() => onArchive(fund)}
                    disabled={readOnly || !isGoalMet || isArchiving}
                    loading={isArchiving}
                  >
                    <Archive size={16} strokeWidth={2} />
                  </ActionIcon>
                )}
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  aria-label={`Edit ${fund.name}`}
                  onClick={() => onEdit(fund)}
                  disabled={readOnly}
                >
                  <Pencil size={16} strokeWidth={2} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Delete ${fund.name}`}
                  onClick={() => onDelete(fund)}
                  disabled={readOnly}
                >
                  <Trash size={16} strokeWidth={2} />
                </ActionIcon>
              </Group>
            </Group>
            <Progress
              value={progress}
              color={progress >= 100 ? "green" : "blue"}
              size="md"
            />
            <Group justify="space-between" mt="sm">
              <Text size="sm">{formatINR(fund.current_amount)} saved</Text>
              <Text size="sm" c={remaining <= 0 ? "green.6" : "dimmed"}>
                {remaining <= 0 ? "Goal met" : `${formatINR(remaining)} to go`}
              </Text>
            </Group>
            <Stack gap={2} mt="xs">
              {fund.monthly_contribution ? (
                <Text size="xs" c="dimmed">
                  Monthly contribution: {formatINR(fund.monthly_contribution)}
                </Text>
              ) : null}
              {fund.target_date ? (
                <Text size="xs" c="dimmed">
                  Target by {dayjs(fund.target_date).format("MMM YYYY")}
                </Text>
              ) : null}
            </Stack>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
};
