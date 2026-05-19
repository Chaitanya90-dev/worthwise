import { Badge, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useAppSelector } from "../../app/hooks";
import {
  buildEmailIngestAddress,
  buildEmailIngestAlias,
} from "../../lib/emailIngest";

export const EmailIngestSettings = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? "");
  const ingestDomain = (import.meta.env.VITE_EMAIL_INGEST_DOMAIN as string | undefined) ?? "";

  const alias = userId ? buildEmailIngestAlias(userId) : "";
  const routingAddress = userId
    ? buildEmailIngestAddress(userId, ingestDomain)
    : null;

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Stack gap="xs">
        <Stack gap={2}>
          <Title order={4}>Email import routing</Title>
          <Text size="sm" c="dimmed">
            Forward bank alerts to your personal routing address to import transactions
            into the right account without relying on sender email matching.
          </Text>
        </Stack>
        <Badge
          variant="light"
          color={routingAddress ? "teal" : "gray"}
          style={{ width: "fit-content" }}
        >
          {routingAddress ? "Address ready" : "Alias ready"}
        </Badge>
        <TextInput
          label={routingAddress ? "Your routing address" : "Your routing alias"}
          value={routingAddress ?? alias}
          readOnly
          description={
            routingAddress
              ? "Use this as the recipient when forwarding bank or payment alert emails."
              : "Set VITE_EMAIL_INGEST_DOMAIN in the frontend env to show the full email address here."
          }
        />
        {routingAddress ? null : (
          <Text size="xs" c="dimmed">
            Expected address format: {alias || "cc_<your-id>"}@your-inbound-domain
          </Text>
        )}
      </Stack>
    </Paper>
  );
};
