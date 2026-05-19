import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect } from "react";
import { formatINR } from "../../lib/format";

export type SharedSplitParticipantDraft = {
  id?: string;
  name: string;
  share_amount: string;
};

export type SharedSplitDraft = {
  mode: "even" | "custom";
  participants: SharedSplitParticipantDraft[];
};

type SharedSplitEditorProps = {
  totalAmount: number;
  value: SharedSplitDraft;
  onChange: (next: SharedSplitDraft) => void;
};

const roundTwo = (value: number) => Math.round(value * 100) / 100;

const calculateEvenShare = (totalAmount: number, participantCount: number) => {
  if (!participantCount || totalAmount <= 0) {
    return 0;
  }
  return roundTwo(totalAmount / (participantCount + 1));
};

export const SharedSplitEditor = ({
  totalAmount,
  value,
  onChange,
}: SharedSplitEditorProps) => {
  const participantCount = value.participants.length;
  const participantsTotal = value.participants.reduce((sum, participant) => {
    const amount = Number(participant.share_amount);
    return Number.isNaN(amount) ? sum : sum + amount;
  }, 0);
  const remaining = roundTwo(totalAmount - participantsTotal);
  const evenShare = calculateEvenShare(totalAmount, participantCount);

  const applyEvenShares = useCallback(
    (participants: SharedSplitParticipantDraft[]) =>
      participants.map((participant) => ({
        ...participant,
        share_amount: evenShare ? String(evenShare) : "",
      })),
    [evenShare]
  );

  useEffect(() => {
    if (value.mode !== "even") {
      return;
    }
    const nextParticipants = applyEvenShares(value.participants);
    const isDifferent = nextParticipants.some(
      (participant, index) =>
        participant.share_amount !== value.participants[index]?.share_amount
    );
    if (isDifferent) {
      onChange({ ...value, participants: nextParticipants });
    }
  }, [
    totalAmount,
    participantCount,
    value.mode,
    value.participants,
    onChange,
    applyEvenShares,
    value,
  ]);

  const handleModeChange = (mode: string) => {
    const nextMode = (mode || "even") as SharedSplitDraft["mode"];
    const nextParticipants =
      nextMode === "even" ? applyEvenShares(value.participants) : value.participants;
    onChange({ ...value, mode: nextMode, participants: nextParticipants });
  };

  const handleAddParticipant = () => {
    const nextParticipants = [
      ...value.participants,
      { name: "", share_amount: value.mode === "even" && evenShare ? String(evenShare) : "" },
    ];
    onChange({
      ...value,
      participants: value.mode === "even" ? applyEvenShares(nextParticipants) : nextParticipants,
    });
  };

  const handleRemoveParticipant = (index: number) => {
    const nextParticipants = value.participants.filter((_, idx) => idx !== index);
    onChange({
      ...value,
      participants: value.mode === "even" ? applyEvenShares(nextParticipants) : nextParticipants,
    });
  };

  const handleParticipantChange = (
    index: number,
    patch: Partial<SharedSplitParticipantDraft>
  ) => {
    const nextParticipants = value.participants.map((participant, idx) =>
      idx === index ? { ...participant, ...patch } : participant
    );
    onChange({ ...value, participants: nextParticipants });
  };

  return (
    <Paper withBorder radius="md" p="sm" style={{ background: "var(--surface-alt)" }}>
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <Text fw={600}>Split details</Text>
          <SegmentedControl
            size="xs"
            value={value.mode}
            onChange={handleModeChange}
            data={[
              { value: "even", label: "Even split" },
              { value: "custom", label: "Custom" },
            ]}
          />
        </Group>
        <Text size="xs" c="dimmed">
          Add the people you are splitting with. Your share is the remaining amount.
        </Text>
        <Stack gap="xs">
          {value.participants.length === 0 ? (
            <Text size="xs" c="dimmed">
              No participants added yet.
            </Text>
          ) : null}
          {value.participants.map((participant, index) => (
            <Group key={`${participant.id ?? "new"}-${index}`} align="flex-end" wrap="nowrap">
              <TextInput
                label="Name"
                value={participant.name}
                onChange={(event) =>
                  handleParticipantChange(index, { name: event.target.value })
                }
                placeholder="e.g., Alex"
                required
                style={{ flex: 1 }}
              />
              <NumberInput
                label="Share"
                value={participant.share_amount}
                onChange={(value) =>
                  handleParticipantChange(index, {
                    share_amount: value === null ? "" : String(value),
                  })
                }
                placeholder="0"
                min={0}
                step={0.01}
                disabled={value.mode === "even"}
                style={{ width: 140 }}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => handleRemoveParticipant(index)}
                aria-label="Remove participant"
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
        <Button
          variant="light"
          size="xs"
          leftSection={<Plus size={14} />}
          onClick={handleAddParticipant}
        >
          Add participant
        </Button>
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="xs" c={remaining < 0 ? "red.6" : "dimmed"}>
            Your share: {formatINR(Math.max(remaining, 0))}
          </Text>
          <Text size="xs" c="dimmed">
            Expected reimbursements: {formatINR(participantsTotal)}
          </Text>
        </Group>
        {remaining < 0 ? (
          <Text size="xs" c="red.6">
            Split exceeds the total amount. Reduce participant shares.
          </Text>
        ) : null}
        {value.mode === "even" && participantCount > 0 ? (
          <Text size="xs" c="dimmed">
            Even split uses {formatINR(evenShare)} per person; rounding is applied.
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
};
