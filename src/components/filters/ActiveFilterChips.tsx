import { Button, Group } from "@mantine/core";
import { X } from "lucide-react";

export type ActiveFilterChip = {
  key: string;
  label: string;
  onClear: () => void;
};

type ActiveFilterChipsProps = {
  items: ActiveFilterChip[];
};

export const ActiveFilterChips = ({ items }: ActiveFilterChipsProps) => {
  if (items.length === 0) {
    return null;
  }
  return (
    <Group gap="xs" wrap="wrap">
      {items.map((item) => (
        <Button
          key={item.key}
          variant="light"
          size="xs"
          rightSection={<X size={12} strokeWidth={2} />}
          onClick={item.onClear}
        >
          {item.label}
        </Button>
      ))}
    </Group>
  );
};
