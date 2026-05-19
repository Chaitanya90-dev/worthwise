import { SimpleGrid, Stack } from "@mantine/core";
import { CategoryManager } from "../components/settings/CategoryManager";
import { AccountManager } from "../components/settings/AccountManager";
import { PaymentManager } from "../components/settings/PaymentManager";
import { TagManager } from "../components/settings/TagManager";
import { ReconciliationManager } from "../components/settings/ReconciliationManager";
import { RuleManager } from "../components/settings/RuleManager";
import { NotificationSettings } from "../components/settings/NotificationSettings";
import { DataExportCard } from "../components/settings/DataExportCard";
import { DataRestoreCard } from "../components/settings/DataRestoreCard";
import { LegacyImportCard } from "../components/settings/LegacyImportCard";
import { TelegramSettings } from "../components/settings/TelegramSettings";
import { TelegramDiagnostics } from "../components/settings/TelegramDiagnostics";
import { EmailIngestSettings } from "../components/settings/EmailIngestSettings";
import { MonetarySettings } from "../components/settings/MonetarySettings";

export const Settings = () => (
  <Stack gap="lg">
    <MonetarySettings />
    <CategoryManager />
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
      <AccountManager />
      <PaymentManager />
      <TagManager />
    </SimpleGrid>
    <ReconciliationManager />
    <RuleManager />
    <TelegramSettings />
    <TelegramDiagnostics />
    <EmailIngestSettings />
    <DataExportCard />
    <DataRestoreCard />
    <LegacyImportCard />
    <NotificationSettings />
  </Stack>
);
