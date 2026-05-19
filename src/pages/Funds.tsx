import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { Plus, Coins, HandCoins } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useGetAccountsQuery,
  useGetFundContributionsQuery,
  useGetFundsQuery,
  useSetFundArchivedMutation,
} from "../features/api/apiSlice";
import type { Fund, FundContribution } from "../types/finance";
import { PageActionMenu } from "../components/common/PageActionMenu";
import { PageStatusChips } from "../components/common/PageStatusChips";
import { FundSummaryCards } from "../components/funds/FundSummaryCards";
import { FundProgressGrid } from "../components/funds/FundProgressGrid";
import { FundContributionChart } from "../components/funds/FundContributionChart";
import { FundContributionTable } from "../components/funds/FundContributionTable";
import { FundFormModal } from "../components/funds/FundFormModal";
import { FundDeleteModal } from "../components/funds/FundDeleteModal";
import { ContributionModal } from "../components/funds/ContributionModal";
import { FundProjectionTable } from "../components/funds/FundProjectionTable";
import { FundAlertsPanel } from "../components/funds/FundAlertsPanel";
import { SpendFromFundModal } from "../components/funds/SpendFromFundModal";
import { formatINR } from "../lib/format";
import { buildFundAlerts, buildFundProjections } from "../lib/fundInsights";
import { useReadOnly } from "../context/ReadOnlyContext";

export const Funds = () => {
  const { data: funds = [], isLoading: isFundsLoading } = useGetFundsQuery();
  const { data: contributions = [], isLoading: isContribLoading } =
    useGetFundContributionsQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const [setFundArchived] = useSetFundArchivedMutation();
  const isReadOnly = useReadOnly();

  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);
  const [fundDeleteTarget, setFundDeleteTarget] = useState<Fund | null>(null);

  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] =
    useState<FundContribution | null>(null);
  const [isSpendModalOpen, setIsSpendModalOpen] = useState(false);
  const [selectedSpendFund, setSelectedSpendFund] = useState<Fund | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingFundId, setArchivingFundId] = useState<string | null>(null);

  const activeFunds = useMemo(
    () => funds.filter((fund) => !fund.is_archived),
    [funds]
  );
  const archivedFunds = useMemo(
    () => funds.filter((fund) => fund.is_archived),
    [funds]
  );
  const visibleFunds = showArchived ? funds : activeFunds;
  const contributionFunds = selectedContribution ? funds : activeFunds;

  const totals = useMemo(() => {
    const target = visibleFunds.reduce((sum, fund) => sum + fund.target_amount, 0);
    const saved = visibleFunds.reduce((sum, fund) => sum + fund.current_amount, 0);
    const monthly = visibleFunds.reduce(
      (sum, fund) => sum + (fund.monthly_contribution ?? 0),
      0
    );
    const progress =
      target > 0 ? Math.max(0, Math.round((saved / target) * 100)) : 0;
    return { target, saved, monthly, progress };
  }, [visibleFunds]);

  const projections = useMemo(
    () => buildFundProjections(visibleFunds),
    [visibleFunds]
  );
  const alerts = useMemo(() => buildFundAlerts(projections), [projections]);
  const cashOnHand = useMemo(
    () => accounts.reduce((sum, account) => sum + (account.current_balance ?? 0), 0),
    [accounts]
  );
  const allocatedTotal = useMemo(
    () => activeFunds.reduce((sum, fund) => sum + fund.current_amount, 0),
    [activeFunds]
  );
  const unallocatedCash = cashOnHand - allocatedTotal;
  const fundStatusChips = useMemo(
    () => [
      {
        id: "visible",
        label: `${visibleFunds.length} visible`,
        color: "blue",
        tooltip: showArchived
          ? "Showing active and archived funds."
          : "Showing active funds only.",
      },
      {
        id: "alerts",
        label: `${alerts.length} alerts`,
        color: alerts.length > 0 ? "orange" : "gray",
        tooltip: "Milestones and pacing alerts generated from fund projections.",
      },
      {
        id: "free-cash",
        label: `Free cash ${formatINR(unallocatedCash)}`,
        color: unallocatedCash < 0 ? "red" : "teal",
        tooltip: "Cash on hand minus money already allocated into active funds.",
      },
    ],
    [alerts.length, showArchived, unallocatedCash, visibleFunds.length]
  );

  const contributionMap = useMemo(
    () => new Map(contributions.map((item) => [item.id, item])),
    [contributions]
  );

  const handleOpenFundCreate = () => {
    if (isReadOnly) {
      return;
    }
    setSelectedFund(null);
    setIsFundModalOpen(true);
  };

  const handleEditFund = (fund: Fund) => {
    if (isReadOnly) {
      return;
    }
    setSelectedFund(fund);
    setIsFundModalOpen(true);
  };

  const handleCloseFundModal = () => {
    setIsFundModalOpen(false);
    setSelectedFund(null);
  };

  const handleDeleteFund = (fund: Fund) => {
    if (isReadOnly) {
      return;
    }
    setFundDeleteTarget(fund);
  };

  const handleCloseFundDelete = () => {
    setFundDeleteTarget(null);
  };

  const handleOpenContribution = () => {
    if (isReadOnly) {
      return;
    }
    if (activeFunds.length === 0) {
      return;
    }
    setSelectedContribution(null);
    setIsContributionModalOpen(true);
  };

  const handleEditContribution = (id: string) => {
    if (isReadOnly) {
      return;
    }
    const contribution = contributionMap.get(id);
    if (!contribution) {
      return;
    }
    setSelectedContribution(contribution);
    setIsContributionModalOpen(true);
  };

  const handleCloseContribution = () => {
    setIsContributionModalOpen(false);
    setSelectedContribution(null);
  };

  const handleOpenSpend = (fund?: Fund) => {
    if (isReadOnly) {
      return;
    }
    if (activeFunds.length === 0) {
      return;
    }
    setSelectedSpendFund(fund ?? null);
    setIsSpendModalOpen(true);
  };

  const handleCloseSpend = () => {
    setIsSpendModalOpen(false);
    setSelectedSpendFund(null);
  };

  const handleArchiveFund = async (fund: Fund) => {
    if (isReadOnly || fund.is_archived || fund.current_amount < fund.target_amount) {
      return;
    }
    try {
      setArchivingFundId(fund.id);
      await setFundArchived({ id: fund.id, is_archived: true }).unwrap();
    } finally {
      setArchivingFundId(null);
    }
  };

  const handleUnarchiveFund = async (fund: Fund) => {
    if (isReadOnly || !fund.is_archived) {
      return;
    }
    try {
      setArchivingFundId(fund.id);
      await setFundArchived({ id: fund.id, is_archived: false }).unwrap();
    } finally {
      setArchivingFundId(null);
    }
  };

  const fundFormKey = `fund-${selectedFund?.id ?? "new"}-${
    isFundModalOpen ? "open" : "closed"
  }`;
  const contributionFormKey = `contrib-${selectedContribution?.id ?? "new"}-${
    isContributionModalOpen ? "open" : "closed"
  }`;
  const spendFormKey = `spend-${selectedSpendFund?.id ?? "new"}-${
    isSpendModalOpen ? "open" : "closed"
  }`;
  const fundOverflowActions = [
    {
      label: "Spend from fund",
      icon: <HandCoins size={16} strokeWidth={2} />,
      onClick: () => handleOpenSpend(),
      disabled: activeFunds.length === 0 || isReadOnly,
    },
    {
      label: "Add contribution",
      icon: <Coins size={16} strokeWidth={2} />,
      onClick: handleOpenContribution,
      disabled: activeFunds.length === 0 || isReadOnly,
    },
  ];

  return (
    <Stack gap="lg">
      <FundFormModal
        key={fundFormKey}
        opened={isFundModalOpen}
        onClose={handleCloseFundModal}
        fund={selectedFund}
        readOnly={isReadOnly}
      />
      <FundDeleteModal
        fund={fundDeleteTarget}
        opened={Boolean(fundDeleteTarget)}
        onClose={handleCloseFundDelete}
      />
      <ContributionModal
        key={contributionFormKey}
        opened={isContributionModalOpen}
        onClose={handleCloseContribution}
        funds={contributionFunds}
        unallocatedCash={unallocatedCash}
        contribution={selectedContribution}
        readOnly={isReadOnly}
      />
      <SpendFromFundModal
        key={spendFormKey}
        opened={isSpendModalOpen}
        onClose={handleCloseSpend}
        funds={activeFunds}
        defaultFund={selectedSpendFund}
        readOnly={isReadOnly}
      />

      <FundSummaryCards
        totals={totals}
        fundCount={visibleFunds.length}
        cashOnHand={cashOnHand}
      />

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Funds</Title>
            <Text size="sm" c="dimmed">
              Manage car, land, emergency, and goal savings.
            </Text>
            <PageStatusChips items={fundStatusChips} />
          </Stack>
          <Group gap="sm" wrap="wrap">
            <PageActionMenu items={fundOverflowActions} />
            <Button
              leftSection={<Plus size={16} strokeWidth={2} />}
              onClick={handleOpenFundCreate}
              disabled={isReadOnly}
            >
              New fund
            </Button>
          </Group>
        </Group>
      </Paper>

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md">
          <Stack gap={2}>
            <Title order={4}>Fund progress</Title>
            <Text size="sm" c="dimmed">
              Live status across goals and funds.
            </Text>
          </Stack>
          <Group gap="sm" align="center">
            <Switch
              size="sm"
              label="Show archived"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.currentTarget.checked)}
            />
            <Badge variant="light" color="blue">
              {activeFunds.length} active
            </Badge>
            {archivedFunds.length > 0 ? (
              <Badge variant="light" color="gray">
                {archivedFunds.length} archived
              </Badge>
            ) : null}
          </Group>
        </Group>
        <FundProgressGrid
          funds={visibleFunds}
          onEdit={handleEditFund}
          onDelete={handleDeleteFund}
          onArchive={handleArchiveFund}
          onUnarchive={handleUnarchiveFund}
          onSpend={handleOpenSpend}
          archivingFundId={archivingFundId}
          readOnly={isReadOnly}
        />
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <FundAlertsPanel alerts={alerts} />
        <FundContributionChart contributions={contributions} />
      </SimpleGrid>

      <FundProjectionTable projections={projections} loading={isFundsLoading} />

      <FundContributionTable
        funds={funds}
        contributions={contributions}
        loading={isFundsLoading || isContribLoading}
        onEditContribution={handleEditContribution}
        readOnly={isReadOnly}
      />
    </Stack>
  );
};
