import { Center, Loader, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { LOGIN_PATH } from "../app/paths";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const status = useAppSelector((state) => state.auth.status);

  if (status === "loading") {
    return (
      <Center mih="60vh">
        <Stack align="center" gap="xs">
          <Loader size="sm" color="brand" />
          <Text size="sm" c="dimmed">
            Checking session...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (status !== "authed") {
    return <Navigate to={LOGIN_PATH} replace />;
  }

  return <>{children}</>;
};
