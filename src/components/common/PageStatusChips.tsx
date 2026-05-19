import { Badge, Group, Tooltip } from "@mantine/core";

export type PageStatusChip = {
  id: string;
  label: string;
  color?: string;
  tooltip?: string;
};

type PageStatusChipsProps = {
  items: PageStatusChip[];
};

export const PageStatusChips = ({ items }: PageStatusChipsProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <Group gap="xs" wrap="wrap">
      {items.map((item) => {
        const badge = (
          <Badge variant="light" color={item.color ?? "gray"} radius="sm">
            {item.label}
          </Badge>
        );

        if (!item.tooltip) {
          return <span key={item.id}>{badge}</span>;
        }

        return (
          <Tooltip key={item.id} label={item.tooltip} withArrow>
            <span>{badge}</span>
          </Tooltip>
        );
      })}
    </Group>
  );
};
