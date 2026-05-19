import { Center, Loader, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { useEncryption } from "./encryptionContext";
import { UnlockScreen } from "./UnlockScreen";

export const EncryptionGate = ({ children }: { children: ReactNode }) => {
  const { status, isFirstTime } = useEncryption();

  if (status === "loading") {
    return (
      <Center mih="60vh">
        <Stack align="center" gap="xs">
          <Loader size="sm" color="brand" />
          <Text size="sm" c="dimmed">
            Unlocking your vault...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (status === "locked") {
    return <UnlockScreen isFirstTime={isFirstTime} />;
  }

  return <>{children}</>;
};
