import { Button, Center, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { APP_BASE_PATH, LOGIN_PATH, PUBLIC_HOME_PATH } from "../app/paths";

export const NotFound = () => {
  const authStatus = useAppSelector((state) => state.auth.status);
  const primaryTo = authStatus === "authed" ? APP_BASE_PATH : PUBLIC_HOME_PATH;
  const primaryLabel = authStatus === "authed" ? "Open app" : "Go home";

  return (
    <Center mih="60vh">
      <Paper withBorder shadow="sm" radius="lg" p="xl">
        <Stack gap="sm">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            404
          </Text>
          <Title order={3}>Page not found</Title>
          <Text size="sm" c="dimmed">
            That page does not exist in CashCove.
          </Text>
          <Group gap="sm" mt="xs">
            <Button component={Link} to={primaryTo}>
              {primaryLabel}
            </Button>
            {authStatus !== "authed" ? (
              <Button component={Link} to={LOGIN_PATH} variant="light">
                Sign in
              </Button>
            ) : null}
          </Group>
        </Stack>
      </Paper>
    </Center>
  );
};
