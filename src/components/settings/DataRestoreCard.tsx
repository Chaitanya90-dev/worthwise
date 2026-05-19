import {
  Alert,
  Button,
  Checkbox,
  FileInput,
  Group,
  Modal,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { UploadCloud } from "lucide-react";
import { useState } from "react";
import { useAppSelector } from "../../app/hooks";
import {
  decryptBackupPayload,
  exportRestoreReport,
  getBackupSummary,
  isEncryptedBackup,
  restoreBackup,
  type BackupPayload,
  type EncryptedBackup,
  validateBackupPayload,
} from "../../lib/backup";
import { SectionCard } from "./SectionCard";

export const DataRestoreCard = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? "");
  const [opened, setOpened] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [encryptedPayload, setEncryptedPayload] =
    useState<EncryptedBackup | null>(null);
  const [backupPayload, setBackupPayload] = useState<BackupPayload | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [useBackupBalances, setUseBackupBalances] = useState(true);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setFile(null);
    setEncryptedPayload(null);
    setBackupPayload(null);
    setPassphrase("");
    setReplaceExisting(true);
    setUseBackupBalances(true);
    setConfirmReplace(false);
    setReporting(false);
    setError(null);
  };

  const handleClose = () => {
    setOpened(false);
    resetState();
  };

  const handleFileChange = async (nextFile: File | null) => {
    setFile(nextFile);
    setError(null);
    setEncryptedPayload(null);
    setBackupPayload(null);
    if (!nextFile) {
      return;
    }
    try {
      const text = await nextFile.text();
      const parsed = JSON.parse(text);
      if (isEncryptedBackup(parsed)) {
        setEncryptedPayload(parsed);
        return;
      }
      const validated = validateBackupPayload(parsed as BackupPayload);
      setBackupPayload(validated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to read this backup file."
      );
    }
  };

  const handleDecrypt = async () => {
    if (!encryptedPayload) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload = await decryptBackupPayload(encryptedPayload, passphrase);
      setBackupPayload(validateBackupPayload(payload));
      setEncryptedPayload(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to decrypt backup file."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!backupPayload) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await restoreBackup(backupPayload, {
        userId,
        wipeExisting: replaceExisting,
        useBackupBalances,
      });
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Restore failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    if (!backupPayload) {
      return;
    }
    setError(null);
    setReporting(true);
    try {
      await exportRestoreReport(backupPayload, {
        wipeExisting: replaceExisting,
        useBackupBalances,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to export the dry-run report."
      );
    } finally {
      setReporting(false);
    }
  };

  const summaryItems = backupPayload ? getBackupSummary(backupPayload) : [];
  const restoreDisabled =
    !backupPayload ||
    !userId ||
    (replaceExisting && !confirmReplace) ||
    loading ||
    reporting;

  return (
    <>
      <SectionCard
        title="Restore from backup"
        description="Import a CashCove backup into this account. Best for new projects or clean resets."
        badge="Restore"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Backups include transactions, budgets, subscriptions, rules, and shared
            spend data.
          </Text>
          <Group>
            <Button leftSection={<UploadCloud size={16} />} onClick={() => setOpened(true)}>
              Open restore wizard
            </Button>
          </Group>
        </Stack>
      </SectionCard>

      <Modal
        opened={opened}
        onClose={handleClose}
        title="Restore backup"
        size="lg"
        centered
      >
        <Stack gap="sm">
          <FileInput
            label="Backup file"
            placeholder="Choose a CashCove backup JSON"
            value={file}
            onChange={handleFileChange}
            accept="application/json"
            clearable
          />

          {encryptedPayload ? (
            <Paper withBorder radius="md" p="sm">
              <Stack gap="sm">
                <Text size="sm" fw={600}>
                  Encrypted backup detected
                </Text>
                <PasswordInput
                  label="Passphrase"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  placeholder="Enter your passphrase"
                  autoComplete="current-password"
                />
                <Group justify="flex-end">
                  <Button variant="light" onClick={handleDecrypt} loading={loading}>
                    Decrypt backup
                  </Button>
                </Group>
              </Stack>
            </Paper>
          ) : null}

          {backupPayload ? (
            <Stack gap="sm">
              <Paper withBorder radius="md" p="sm">
                <Stack gap="xs">
                  <Title order={5}>Backup summary</Title>
                  <Group gap="md" wrap="wrap">
                    {summaryItems.map((item) => (
                      <Stack key={item.label} gap={2}>
                        <Text size="xs" c="dimmed">
                          {item.label}
                        </Text>
                        <Text fw={600}>{item.count}</Text>
                      </Stack>
                    ))}
                  </Group>
                </Stack>
              </Paper>

              <Stack gap="xs">
                <Checkbox
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.currentTarget.checked)}
                  label="Replace my existing data before importing"
                />
                <Checkbox
                  checked={useBackupBalances}
                  onChange={(event) => setUseBackupBalances(event.currentTarget.checked)}
                  label="Use account balances from backup (recommended)"
                />
                {replaceExisting ? (
                  <Checkbox
                    checked={confirmReplace}
                    onChange={(event) =>
                      setConfirmReplace(event.currentTarget.checked)
                    }
                    label="I understand this will overwrite my current data"
                  />
                ) : null}
              </Stack>
              <Group justify="flex-end">
                <Button
                  variant="light"
                  onClick={handleExportReport}
                  loading={reporting}
                >
                  Download dry-run report
                </Button>
              </Group>
            </Stack>
          ) : null}

          {error ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}

          {!userId ? (
            <Alert color="red" variant="light">
              Sign in before restoring a backup.
            </Alert>
          ) : null}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              loading={loading}
              disabled={restoreDisabled}
            >
              Restore data
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
