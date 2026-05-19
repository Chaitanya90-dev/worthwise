import { Button, Group, Stack, Text } from "@mantine/core";
import { UploadCloud } from "lucide-react";
import { useState } from "react";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
} from "../../features/api/apiSlice";
import { TransactionImportModal } from "../transactions/TransactionImportModal";
import { SectionCard } from "./SectionCard";

export const LegacyImportCard = () => {
  const [opened, setOpened] = useState(false);
  const { data: categories = [], isLoading: isLoadingCategories } =
    useGetCategoriesQuery();
  const { data: paymentMethods = [], isLoading: isLoadingPayments } =
    useGetPaymentMethodsQuery();
  const { data: accounts = [], isLoading: isLoadingAccounts } =
    useGetAccountsQuery();

  const isLoading = isLoadingCategories || isLoadingPayments || isLoadingAccounts;

  return (
    <>
      <SectionCard
        title="Import from another app"
        description="Map CSV exports from other tools and bring transactions into CashCove."
        badge="CSV"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Use this for CSV exports from other finance apps. Missing categories,
            payment methods, or accounts can be created automatically.
          </Text>
          <Group>
            <Button
              leftSection={<UploadCloud size={16} />}
              onClick={() => setOpened(true)}
              loading={isLoading}
            >
              Import CSV
            </Button>
          </Group>
        </Stack>
      </SectionCard>

      <TransactionImportModal
        opened={opened}
        onClose={() => setOpened(false)}
        categories={categories}
        paymentMethods={paymentMethods}
        accounts={accounts}
        title="Import CSV from another app"
        allowReferenceCreate
      />
    </>
  );
};
