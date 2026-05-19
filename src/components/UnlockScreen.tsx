import {
  Alert,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useState } from "react";
import type { FormEvent } from "react";
import { useEncryption } from "./encryptionContext";

export const UnlockScreen = ({ isFirstTime }: { isFirstTime: boolean }) => {
  const { unlock } = useEncryption();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passphrase.trim()) {
      setError("Enter a passphrase to unlock your data.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await unlock(passphrase.trim());
      setPassphrase("");
    } catch (err) {
      if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError("Unable to unlock. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center mih="60vh" px="md">
      <Paper withBorder shadow="sm" radius="lg" p="xl" w={420}>
        <Stack gap="xs">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Encrypted vault
          </Text>
          <Title order={2}>
            {isFirstTime ? "Create passphrase" : "Unlock CashCove"}
          </Title>
          <Text size="sm" c="dimmed">
            {isFirstTime
              ? "Set a passphrase to encrypt sensitive fields on this device."
              : "Enter your passphrase once to decrypt sensitive fields on this device."}
          </Text>
        </Stack>
        <Stack component="form" gap="sm" mt="md" onSubmit={handleSubmit}>
          <PasswordInput
            label="Passphrase"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder={
              isFirstTime ? "Create a remembered key" : "Your remembered key"
            }
            required
          />
          {error ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}
          <Button type="submit" loading={loading}>
            {isFirstTime ? "Create & unlock" : "Unlock"}
          </Button>
        </Stack>
        <Text size="xs" c="dimmed" mt="md">
          {isFirstTime
            ? "Use the same passphrase on every device to access your encrypted notes."
            : "Your key is stored locally in IndexedDB so you do not need to re-enter it each session."}
        </Text>
      </Paper>
    </Center>
  );
};
