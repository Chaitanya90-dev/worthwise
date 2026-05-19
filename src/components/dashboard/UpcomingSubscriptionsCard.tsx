import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { appPath } from "../../app/paths";
import { formatINR } from "../../lib/format";
import {
  getSubscriptionNativeAmountLabel,
  getSubscriptionPlanningAmount,
  getSubscriptionPlanningAmountLabel,
  getUpcomingSubscriptions,
  isForeignCurrencySubscription,
} from "../../lib/subscriptions";
import { getBaseCurrency } from "../../lib/moneyConfig";
import { EmptyState } from "../common/EmptyState";
import type { Subscription } from "../../types/finance";

type UpcomingSubscriptionsCardProps = {
  subscriptions: Subscription[];
  style?: React.CSSProperties;
};

export const UpcomingSubscriptionsCard = ({
  subscriptions,
  style,
}: UpcomingSubscriptionsCardProps) => {
  const upcoming = useMemo(
    () => getUpcomingSubscriptions(subscriptions, 30),
    [subscriptions]
  );
  const total = useMemo(
    () => upcoming.reduce((sum, sub) => sum + getSubscriptionPlanningAmount(sub), 0),
    [upcoming]
  );
  const foreignCurrencyCount = useMemo(
    () => upcoming.filter((sub) => isForeignCurrencySubscription(sub)).length,
    [upcoming]
  );
  const baseCurrency = getBaseCurrency();
  const isEmpty = upcoming.length === 0;

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Group justify="space-between" align="center" mb="xs">
        <Stack gap={4}>
          <Title order={4}>Upcoming renewals</Title>
          <Text size="sm" c="dimmed">
            Bills due in the next 30 days.
          </Text>
        </Stack>
        <Badge variant="light" color="blue">
          {upcoming.length} due
        </Badge>
      </Group>
      <Group justify="space-between" align="center" mb="sm">
        <Text size="sm" c="dimmed">
          Estimated total due
        </Text>
        <Text fw={700}>{formatINR(total)}</Text>
      </Group>
      {foreignCurrencyCount > 0 ? (
        <Text size="xs" c="dimmed" mb="sm">
          {foreignCurrencyCount} renewal{foreignCurrencyCount === 1 ? "" : "s"} use saved {baseCurrency} planning amounts.
        </Text>
      ) : null}
      {isEmpty ? (
        <EmptyState
          description="Nothing due soon. Add subscriptions to track renewals."
          action={{
            label: "Add subscriptions",
            to: appPath("/subscriptions"),
            variant: "light",
            color: "blue",
          }}
        />
      ) : (
        <Stack gap={8}>
          {upcoming.slice(0, 5).map((sub) => (
            <Group key={sub.id} justify="space-between" align="center">
              <Stack gap={2}>
                <Text fw={600}>{sub.name}</Text>
                <Text size="xs" c="dimmed">
                  Due {dayjs(sub.next_due).format("DD MMM")}
                  {isForeignCurrencySubscription(sub)
                    ? ` · ${getSubscriptionNativeAmountLabel(sub)}`
                    : ""}
                </Text>
              </Stack>
              <Text fw={600}>{getSubscriptionPlanningAmountLabel(sub)}</Text>
            </Group>
          ))}
        </Stack>
      )}
      {!isEmpty ? (
        <Button
          component={Link}
          to={appPath("/subscriptions")}
          variant="subtle"
          color="gray"
          size="xs"
          mt="md"
          rightSection={<ArrowUpRight size={14} />}
        >
          View subscriptions
        </Button>
      ) : null}
    </Paper>
  );
};
