import { Alert, Button, Group, PasswordInput, Stack, Switch, Text } from "@mantine/core";
import { Download, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { exportBackupJson, exportTransactionsCsv } from "../../lib/backup";
import { SectionCard } from "./SectionCard";

export const DataExportCard = () => {
  const [encryptBackup, setEncryptBackup] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"backup" | "csv" | null>(null);

  const handleExportBackup = async () => {
    setError(null);
    setExporting("backup");
    try {
      await exportBackupJson({ encrypt: encryptBackup, passphrase });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to export backup right now."
      );
    } finally {
      setExporting(null);
    }
  };

  const handleExportCsv = async () => {
    setError(null);
    setExporting("csv");
    try {
      await exportTransactionsCsv();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to export CSV right now."
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <SectionCard
      title="Data exports & backup"
      description="Download your data anytime. Encrypted backups stay private even outside CashCove."
      badge="Ownership"
    >
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" fw={600}>
            Backup file
          </Text>
          <Switch
            checked={encryptBackup}
            onChange={(event) => setEncryptBackup(event.currentTarget.checked)}
            label={encryptBackup ? "Encrypted" : "Plain JSON"}
            size="sm"
          />
        </Group>
        <PasswordInput
          label="Backup passphrase"
          placeholder="At least 8 characters"
          value={passphrase}
          onChange={(event) => setPassphrase(event.currentTarget.value)}
          disabled={!encryptBackup}
          autoComplete="new-password"
        />
        <Text size="xs" c="dimmed">
          Keep this passphrase safe. CashCove cannot recover it if you lose it.
        </Text>
        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <Group gap="sm" wrap="wrap">
          <Button
            variant="light"
            leftSection={<Download size={16} />}
            onClick={handleExportCsv}
            loading={exporting === "csv"}
          >
            Export transactions CSV
          </Button>
          <Button
            leftSection={encryptBackup ? <LockKeyhole size={16} /> : <Download size={16} />}
            onClick={handleExportBackup}
            loading={exporting === "backup"}
          >
            Download backup
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
};
