import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  Banknote,
  CalendarClock,
  ChartNoAxesCombined,
  Gauge,
  Landmark,
  PiggyBank,
  ScrollText,
  Settings,
} from 'lucide-react';
import { NavLink as RouterNavLink, Outlet, useLocation } from 'react-router-dom';
import { paths } from '../../app/paths';

const navItems = [
  { label: 'Dashboard', to: paths.dashboard, icon: Gauge },
  { label: 'Accounts', to: paths.accounts, icon: Banknote },
  { label: 'Loans', to: paths.loans, icon: Landmark },
  { label: 'Upcoming', to: paths.upcoming, icon: CalendarClock },
  { label: 'Insurance', to: paths.insurance, icon: ScrollText },
  { label: 'Mutual Funds', to: paths.mutualFunds, icon: ChartNoAxesCombined },
  { label: 'Settings', to: paths.settings, icon: Settings },
];

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 252,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <ThemeIcon color="teal" radius="md" size={38}>
              <PiggyBank size={22} />
            </ThemeIcon>
            <Stack gap={0}>
              <Title order={2}>Worthwise</Title>
              <Text size="xs" c="dimmed">
                INR personal finance
              </Text>
            </Stack>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap={4}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === paths.dashboard
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                component={RouterNavLink}
                to={item.to}
                label={item.label}
                active={active}
                onClick={close}
                leftSection={<Icon size={18} />}
              />
            );
          })}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

