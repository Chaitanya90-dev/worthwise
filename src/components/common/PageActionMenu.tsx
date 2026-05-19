import { ActionIcon, Button, Menu } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

export type PageActionMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
};

type PageActionMenuProps = {
  items: PageActionMenuItem[];
  buttonLabel?: string;
  ariaLabel?: string;
};

export const PageActionMenu = ({
  items,
  buttonLabel = "More",
  ariaLabel = "Open more actions",
}: PageActionMenuProps) => {
  const isMobile = useMediaQuery("(max-width: 900px)");
  const visibleItems = items.filter(Boolean);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <Menu position="bottom-end" withArrow withinPortal>
      <Menu.Target>
        {isMobile ? (
          <ActionIcon variant="light" size="lg" aria-label={ariaLabel}>
            <MoreHorizontal size={18} />
          </ActionIcon>
        ) : (
          <Button
            variant="light"
            color="gray"
            leftSection={<MoreHorizontal size={16} strokeWidth={2} />}
          >
            {buttonLabel}
          </Button>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        {visibleItems.map((item) => (
          <Menu.Item
            key={item.label}
            leftSection={item.icon}
            onClick={item.onClick}
            disabled={item.disabled}
            color={item.color}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
};
