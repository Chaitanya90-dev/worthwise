import { Paper, SimpleGrid, Text, Title } from "@mantine/core";
import { formatINR } from "../../lib/format";

type FundSummaryCardsProps = {
  totals: {
    target: number;
    saved: number;
    monthly: number;
    progress: number;
  };
  fundCount: number;
  cashOnHand: number;
};

export const FundSummaryCards = ({
  totals,
  fundCount,
  cashOnHand,
}: FundSummaryCardsProps) => {
  const coverage = cashOnHand - totals.saved;
  const coverageLabel =
    coverage >= 0 ? `Unallocated cash ${formatINR(coverage)}` : "Over-allocated";

  return (
    <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Total saved
      </Text>
      <Title order={3} mt="xs">
        {formatINR(totals.saved)}
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        Across {fundCount} funds
      </Text>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Total target
      </Text>
      <Title order={3} mt="xs">
        {formatINR(totals.target)}
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        Monthly plan {formatINR(totals.monthly)}
      </Text>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Progress
      </Text>
      <Title order={3} mt="xs">
        {totals.progress}%
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        Towards all goals
      </Text>
    </Paper>
      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Text size="sm" c="dimmed">
          Cash coverage
        </Text>
        <Title order={3} mt="xs">
          {formatINR(cashOnHand)}
        </Title>
        <Text size="sm" c={coverage >= 0 ? "green" : "red"} fw={600}>
          {coverageLabel}
        </Text>
      </Paper>
  </SimpleGrid>
  );
};
