import { Group, Paper, Progress, Stack, Text, Title } from "@mantine/core";
import { formatINR } from "../../lib/format";
import type { Fund } from "../../types/finance";

type CoverageCardProps = {
  cashOnHand: number;
  funds: Fund[];
  style?: React.CSSProperties;
};

export const CoverageCard = ({ cashOnHand, funds, style }: CoverageCardProps) => {
  const allocated = funds.reduce((sum, fund) => sum + fund.current_amount, 0);
  const coverage = cashOnHand - allocated;
  const coveragePercent =
    allocated > 0 ? Math.min(150, Math.max(-50, (cashOnHand / allocated) * 100)) : 100;

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Title order={4} mb={4}>
        Coverage
      </Title>
      <Text size="sm" c="dimmed" mb="xs">
        Cash vs allocated funds
      </Text>
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            Cash on hand
          </Text>
          <Text fw={700}>{formatINR(cashOnHand)}</Text>
        </Stack>
        <Stack gap={2} ta="right">
          <Text size="sm" c="dimmed">
            Allocated
          </Text>
          <Text fw={700}>{formatINR(allocated)}</Text>
        </Stack>
      </Group>
      <Progress
        mt="sm"
        value={coveragePercent}
        color={coverage >= 0 ? "teal" : "red"}
        size="lg"
        radius="md"
      />
      <Text size="sm" c={coverage >= 0 ? "teal.7" : "red.7"} fw={600} mt={6}>
        {coverage >= 0
          ? `${formatINR(coverage)} unallocated`
          : `${formatINR(Math.abs(coverage))} short`}
      </Text>
    </Paper>
  );
};
