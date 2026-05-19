import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  NavLink as MantineNavLink,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import dayjs from "dayjs";
import {
  LayoutGrid,
  List,
  Wallet,
  PiggyBank,
  Landmark,
  Repeat,
  CalendarDays,
  BarChart3,
  Settings as SettingsIcon,
  Search,
  RefreshCcw,
  LogOutIcon,
  ChevronsRight,
  ChevronsLeft,
  MoreHorizontal,
  Plus,
  Zap,
  Info,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  NavLink as RouterNavLink,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import {
  DESKTOP_NAV_ITEMS,
  MOBILE_OVERFLOW_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
  ROUTE_TITLE_MAP,
  isNavItemActivePath,
} from "../app/routes";
import { APP_BASE_PATH, appPath } from "../app/paths";
import {
  apiSlice,
  useGetAccountsQuery,
  useGetBudgetsQuery,
  useGetCategoriesQuery,
  useGetPreferencesQuery,
  useGetTransactionsQuery,
} from "../features/api/apiSlice";
import { clearAuth } from "../features/auth/authSlice";
import { supabase } from "../lib/supabaseClient";
import { QuickAddDrawer } from "./quickAdd/QuickAddDrawer";
import { GlobalSearchDrawer } from "./search/GlobalSearchDrawer";
import { QuickActionsModal } from "./quickActions/QuickActionsModal";
import { useAppMonth } from "../context/AppMonthContext";
import { ReadOnlyProvider } from "../context/ReadOnlyContext";
import { formatINR } from "../lib/format";
import { buildCategoryDisplayMap } from "../lib/categories";
import { buildBudgetWarnings, calculateDashboardMetrics } from "../lib/dashboard";
import { getDefaultTimezone, getDefaultUserPreferences } from "../lib/userPreferences";

const navIconMap: Record<string, ReactNode> = {
  [APP_BASE_PATH]: <LayoutGrid size={18} />,
  [appPath("/transactions")]: <List size={18} />,
  [appPath("/subscriptions")]: <Repeat size={18} />,
  [appPath("/bills")]: <CalendarDays size={18} />,
  [appPath("/reports")]: <BarChart3 size={18} />,
  [appPath("/budgets")]: <Wallet size={18} />,
  [appPath("/funds")]: <PiggyBank size={18} />,
  [appPath("/loans")]: <Landmark size={18} />,
  [appPath("/settings")]: <SettingsIcon size={18} />,
};

const mobileNavIconMap: Record<string, ReactNode> = {
  [APP_BASE_PATH]: <LayoutGrid size={20} />,
  [appPath("/transactions")]: <List size={20} />,
  [appPath("/bills")]: <CalendarDays size={20} />,
  [appPath("/budgets")]: <Wallet size={20} />,
  [appPath("/subscriptions")]: <Repeat size={18} />,
  [appPath("/loans")]: <Landmark size={18} />,
  [appPath("/funds")]: <PiggyBank size={18} />,
  [appPath("/reports")]: <BarChart3 size={18} />,
  [appPath("/settings")]: <SettingsIcon size={18} />,
};

export const AppLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem("cashcove:sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const [isSidebarHovering, setIsSidebarHovering] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 900px)");
  const { month, setMonth } = useAppMonth();
  const isNavExpanded = useMemo(
    () => isMobile || !isCollapsed || isSidebarHovering,
    [isCollapsed, isSidebarHovering, isMobile]
  );
  const sidebarWidth = useMemo(() => {
    if (isMobile) {
      return "100%";
    }
    if (isCollapsed) {
      return isSidebarHovering ? 240 : 76;
    }
    return 260;
  }, [isCollapsed, isSidebarHovering, isMobile]);
  const user = useAppSelector((state) => state.auth.user);
  const offlineQueue = useAppSelector((state) => state.offlineQueue);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { data: preferences } = useGetPreferencesQuery(user?.id ?? "", {
    skip: !user?.id,
  });
  const isReadOnly = Boolean(preferences?.is_readonly);
  const moneyDefaults = useMemo(() => getDefaultUserPreferences(), []);
  const headerTimeZone =
    preferences?.weekly_summary_timezone ?? getDefaultTimezone();
  const headerCurrency =
    preferences?.display_currency ?? moneyDefaults.display_currency;
  const headerLocale = preferences?.locale ?? moneyDefaults.locale;
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: budgets = [] } = useGetBudgetsQuery(month);
  const { data: transactions = [] } = useGetTransactionsQuery({ month });

  const cashTotal = useMemo(
    () => accounts.reduce((sum, account) => sum + (account.current_balance ?? 0), 0),
    [accounts]
  );
  const categoryMap = useMemo(
    () => buildCategoryDisplayMap(categories, false),
    [categories]
  );
  const budgetMetrics = useMemo(
    () => calculateDashboardMetrics(transactions, budgets),
    [transactions, budgets]
  );
  const budgetWarnings = useMemo(
    () =>
      buildBudgetWarnings({
        overallBudget: budgetMetrics.overallBudget,
        totalSpent: budgetMetrics.totalSpent,
        categoryBudgets: budgetMetrics.categoryBudgets,
        categoryTotals: budgetMetrics.categoryTotals,
        categoryMap,
      }),
    [
      budgetMetrics.overallBudget,
      budgetMetrics.totalSpent,
      budgetMetrics.categoryBudgets,
      budgetMetrics.categoryTotals,
      categoryMap,
    ]
  );
  const budgetRatio =
    budgetMetrics.totalBudget > 0
      ? budgetMetrics.totalSpent / budgetMetrics.totalBudget
      : 0;
  const budgetPercent = Math.min(999, Math.round(budgetRatio * 100));
  const budgetLabel =
    budgetMetrics.totalBudget > 0 ? `${budgetPercent}% used` : "No budget";
  const budgetDetails =
    budgetMetrics.totalBudget > 0
      ? `${formatINR(budgetMetrics.totalSpent)} of ${formatINR(
          budgetMetrics.totalBudget
        )}`
      : "Set a budget to track usage.";
  const budgetColor =
    budgetMetrics.totalBudget <= 0
      ? "gray"
      : budgetRatio >= 1
      ? "red"
      : budgetRatio >= 0.8
      ? "orange"
      : "teal";
  const alertsLabel =
    budgetWarnings.length > 0
      ? `${budgetWarnings.length} alert${budgetWarnings.length === 1 ? "" : "s"}`
      : "No alerts";
  const alertsColor = budgetWarnings.length > 0 ? "orange" : "gray";
  const offlineStatusLabel = offlineQueue.isSyncing
    ? `Syncing ${offlineQueue.pendingCount} queued`
    : `Queued ${offlineQueue.pendingCount}`;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    dispatch(clearAuth());
    dispatch(apiSlice.util.resetApiState());
  };

  const title = ROUTE_TITLE_MAP[location.pathname] ?? "CashCove";
  const shellClassName = `app-shell${isCollapsed ? " collapsed" : ""}`;
  const shellStyle = {
    gridTemplateColumns: isMobile ? "1fr" : `${sidebarWidth}px 1fr`,
    gridTemplateRows: isMobile ? "1fr" : undefined,
    transition: "grid-template-columns 200ms ease",
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        "cashcove:sidebar",
        isCollapsed ? "collapsed" : "expanded"
      );
    } catch {
      // Ignore storage errors (e.g., storage disabled).
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.key.toLowerCase() !== "k") {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }
      event.preventDefault();
      setQuickAddOpen(true);
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || !event.shiftKey || event.key.toLowerCase() !== "f") {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }
      event.preventDefault();
      setGlobalSearchOpen(true);
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.key !== ".") {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }
      event.preventDefault();
      setQuickActionsOpen(true);
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, []);

  const navItems = DESKTOP_NAV_ITEMS.map((item) => ({
    ...item,
    to: item.path,
    icon: navIconMap[item.path],
  }));
  const mobilePrimaryNavItems = MOBILE_PRIMARY_NAV_ITEMS.map((item) => ({
    ...item,
    to: item.path,
    icon: mobileNavIconMap[item.path],
  }));
  const mobileOverflowNavItems = MOBILE_OVERFLOW_NAV_ITEMS.map((item) => ({
    ...item,
    to: item.path,
    icon: mobileNavIconMap[item.path],
  }));

  const isMobileOverflowActive = mobileOverflowNavItems.some((item) =>
    isNavItemActivePath(location.pathname, item.to)
  );

  useEffect(() => {
    setMobileMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile) {
      setMobileMoreOpen(false);
    }
  }, [isMobile]);

  return (
    <div
      className={shellClassName}
      style={shellStyle}
      aria-label="CashCove layout shell"
    >
      <QuickAddDrawer
        opened={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        readOnly={isReadOnly}
      />
      <GlobalSearchDrawer
        opened={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onOpenQuickAdd={() => setQuickAddOpen(true)}
        onOpenQuickActions={() => setQuickActionsOpen(true)}
      />
      <QuickActionsModal
        opened={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
      />
      <Drawer
        opened={isMobile && mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        position="bottom"
        size="auto"
        title="More"
        classNames={{
          content: "mobile-more-drawer",
          header: "mobile-more-drawer-header",
          body: "mobile-more-drawer-body",
        }}
        overlayProps={{ backgroundOpacity: 0.3, blur: 5 }}
      >
        <Stack gap="lg">
          <div className="mobile-overflow-section">
            <Text
              size="xs"
              fw={700}
              c="dimmed"
              tt="uppercase"
              style={{ letterSpacing: "0.14em" }}
            >
              Navigate
            </Text>
            <div className="mobile-overflow-grid">
              {mobileOverflowNavItems.map((item) => (
                <RouterNavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileMoreOpen(false)}
                  className={({ isActive }) =>
                    `mobile-overflow-link${isActive ? " active" : ""}`
                  }
                >
                  <span className="mobile-overflow-link-icon">{item.icon}</span>
                  <span className="mobile-overflow-link-copy">
                    <span className="mobile-overflow-link-label">
                      {item.label}
                    </span>
                    <span className="mobile-overflow-link-description">
                      {item.description}
                    </span>
                  </span>
                </RouterNavLink>
              ))}
            </div>
          </div>

          <div className="mobile-overflow-section">
            <Text
              size="xs"
              fw={700}
              c="dimmed"
              tt="uppercase"
              style={{ letterSpacing: "0.14em" }}
            >
              Tools
            </Text>
            <div className="mobile-overflow-grid">
              <button
                type="button"
                className="mobile-overflow-link"
                onClick={() => {
                  setMobileMoreOpen(false);
                  setGlobalSearchOpen(true);
                }}
              >
                <span className="mobile-overflow-link-icon">
                  <Search size={18} />
                </span>
                <span className="mobile-overflow-link-copy">
                  <span className="mobile-overflow-link-label">Search</span>
                  <span className="mobile-overflow-link-description">
                    Find anything in the app
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="mobile-overflow-link"
                onClick={() => {
                  setMobileMoreOpen(false);
                  setQuickActionsOpen(true);
                }}
              >
                <span className="mobile-overflow-link-icon">
                  <Zap size={18} />
                </span>
                <span className="mobile-overflow-link-copy">
                  <span className="mobile-overflow-link-label">Actions</span>
                  <span className="mobile-overflow-link-description">
                    Jump to common tasks
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="mobile-overflow-link"
                onClick={() => globalThis.location.reload()}
              >
                <span className="mobile-overflow-link-icon">
                  <RefreshCcw size={18} />
                </span>
                <span className="mobile-overflow-link-copy">
                  <span className="mobile-overflow-link-label">Refresh</span>
                  <span className="mobile-overflow-link-description">
                    Reload the current view
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="mobile-overflow-link"
                onClick={handleSignOut}
              >
                <span className="mobile-overflow-link-icon">
                  <LogOutIcon size={18} />
                </span>
                <span className="mobile-overflow-link-copy">
                  <span className="mobile-overflow-link-label">Sign out</span>
                  <span className="mobile-overflow-link-description">
                    End this session
                  </span>
                </span>
              </button>
            </div>
          </div>
        </Stack>
      </Drawer>
      {isMobile ? null : (
        <aside
          className="sidebar"
          onMouseEnter={() =>
            !isMobile && isCollapsed && setIsSidebarHovering(true)
          }
          onMouseLeave={() => !isMobile && setIsSidebarHovering(false)}
          style={{ width: "100%", transition: "width 200ms ease" }}
        >
          <div className="sidebar-header">
            <Group justify="space-between" align="center" wrap="nowrap">
              <Group gap="sm" align="center" wrap="nowrap">
                <div className="brand-mark">C</div>
                {isNavExpanded ? (
                  <div className="brand-text">
                    <Title order={4}>CashCove</Title>
                  </div>
                ) : null}
              </Group>
              {isNavExpanded && !isMobile ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="md"
                  onClick={() => setIsCollapsed((current) => !current)}
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-pressed={isCollapsed}
                  title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {isCollapsed ? (
                    <ChevronsRight size={18} />
                  ) : (
                    <ChevronsLeft size={18} />
                  )}
                </ActionIcon>
              ) : null}
            </Group>
          </div>
          <div className="sidebar-body">
            <ScrollArea type="scroll" offsetScrollbars style={{ flex: 1 }}>
              <Stack gap="md">
                <Stack gap="xs">
                  {navItems.map((item) => {
                    const isActive = isNavItemActivePath(location.pathname, item.to);
                    const navLink = (
                      <MantineNavLink
                        component={RouterNavLink}
                        to={item.to}
                        label={item.label}
                        aria-label={item.label}
                        leftSection={
                          <ThemeIcon
                            variant={isActive ? "filled" : "light"}
                            color="brand"
                            radius="md"
                            size={32}
                          >
                            {item.icon}
                          </ThemeIcon>
                        }
                        active={isActive}
                        variant="subtle"
                        styles={{
                          root: {
                            borderRadius: "12px",
                            padding: isNavExpanded ? "8px 10px" : undefined,
                            border:
                              isActive && isNavExpanded
                                ? "1px solid var(--stroke)"
                                : undefined,
                            backgroundColor:
                              isActive && isNavExpanded
                                ? "var(--surface-alt)"
                                : undefined,
                          },
                          body: {
                            justifyContent: isNavExpanded
                              ? "flex-start"
                              : "center",
                          },
                          label: {
                            display: isNavExpanded ? "block" : "none",
                            fontWeight: 600,
                          },
                          section: {
                            marginInlineEnd: isNavExpanded ? 12 : 0,
                          },
                        }}
                      />
                    );

                    return isNavExpanded ? (
                      <div key={item.to}>{navLink}</div>
                    ) : (
                      <Tooltip
                        key={item.to}
                        label={item.label}
                        position="right"
                        withArrow
                      >
                        {navLink}
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Stack>
            </ScrollArea>
          </div>
          <div className="sidebar-footer">
            <Stack gap="sm" align={isNavExpanded ? "stretch" : "center"}>
              {isNavExpanded ? (
                <Paper withBorder radius="md" p="sm">
                  <Text size="sm" c="dimmed">
                    {user?.email ?? ""}
                  </Text>
                </Paper>
              ) : null}
              {isNavExpanded ? (
                <Button
                  variant="light"
                  color="gray"
                  leftSection={
                    <ThemeIcon
                      variant="transparent"
                      color="gray"
                      radius="md"
                      size={28}
                    >
                      <LogOutIcon size={20} />
                    </ThemeIcon>
                  }
                  onClick={handleSignOut}
                  fullWidth
                >
                  Sign out
                </Button>
              ) : (
                <Tooltip label="Sign out" position="right" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    onClick={handleSignOut}
                    aria-label="Sign out"
                  >
                    <LogOutIcon size={20} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Stack>
          </div>
        </aside>
      )}
      <main className="main">
        <Paper withBorder radius="lg" p="md" className="topbar-card">
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              {!isMobile ? (
                <Text
                  size="xs"
                  c="dimmed"
                  tt="uppercase"
                  fw={700}
                  style={{ letterSpacing: "0.14em" }}
                >
                  Monthly snapshot
                </Text>
              ) : null}
              <Group gap="xs">
                <Title order={2}>{title}</Title>
                <Divider orientation="vertical" />
                <Badge variant="light" color="blue">
                  {headerTimeZone} · {headerCurrency} · {headerLocale}
                </Badge>
              </Group>
              <Group gap="xs" wrap="wrap">
                <Tooltip label="Total cash across accounts" withArrow>
                  <Badge
                    variant="light"
                    color={cashTotal < 0 ? "red" : "teal"}
                  >
                    Cash {formatINR(cashTotal)}
                  </Badge>
                </Tooltip>
                <Tooltip label={budgetDetails} withArrow>
                  <Badge variant="light" color={budgetColor}>
                    Budget {budgetLabel}
                  </Badge>
                </Tooltip>
                <Tooltip label="Budgets nearing or over the limit" withArrow>
                  <Badge variant="light" color={alertsColor}>
                    {alertsLabel}
                  </Badge>
                </Tooltip>
                {isReadOnly ? (
                  <Badge variant="light" color="orange">
                    Demo · Read-only
                  </Badge>
                ) : null}
                {!offlineQueue.isOnline ? (
                  <Badge variant="light" color="red">
                    Offline
                  </Badge>
                ) : null}
                {offlineQueue.pendingCount > 0 ? (
                  <Tooltip
                    label={
                      offlineQueue.lastError
                        ? `Last sync issue: ${offlineQueue.lastError}`
                        : "Saved locally and will sync when online."
                    }
                    withArrow
                  >
                    <Badge
                      variant="light"
                      color={offlineQueue.isSyncing ? "blue" : "orange"}
                    >
                      {offlineStatusLabel}
                    </Badge>
                  </Tooltip>
                ) : null}
              </Group>
            </Stack>
            <Group gap="xs" className="topbar-actions" align="flex-end">
              <MonthPickerInput
                label="Month"
                value={dayjs(month + "-01").toDate()}
                onChange={(value) =>
                  value && setMonth(dayjs(value).format("YYYY-MM"))
                }
                maxDate={dayjs().endOf("month").toDate()}
                size="xs"
                clearable={false}
                styles={{ input: { width: 160 } }}
              />
              {isMobile ? (
                <Tooltip label="Quick actions (Ctrl/⌘ + .)" position="left" withArrow>
                  <ActionIcon
                    variant="light"
                    color="gray"
                    size="md"
                    onClick={() => setQuickActionsOpen(true)}
                    aria-label="Open quick actions"
                  >
                    <Zap size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Button
                  variant="light"
                  color="gray"
                  size="compact-sm"
                  onClick={() => setQuickActionsOpen(true)}
                  leftSection={<Zap size={16} strokeWidth={2} />}
                  style={{ marginBottom: "2px" }}
                >
                  Actions
                </Button>
              )}
              {isMobile ? (
                <Tooltip label="Search (Ctrl/⌘ + Shift + F)" position="left" withArrow>
                  <ActionIcon
                    variant="light"
                    color="gray"
                    size="md"
                    onClick={() => setGlobalSearchOpen(true)}
                    aria-label="Open global search"
                  >
                    <Search size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Button
                  variant="light"
                  color="gray"
                  size="compact-sm"
                  onClick={() => setGlobalSearchOpen(true)}
                  leftSection={<Search size={16} strokeWidth={2} />}
                  style={{ marginBottom: "2px" }}
                >
                  Search
                </Button>
              )}
              {isMobile ? (
                <Tooltip label="Refresh" position="left" withArrow>
                  <ActionIcon
                    variant="light"
                    color="gray"
                    size="md"
                    onClick={() => globalThis.location.reload()}
                    aria-label="Refresh"
                  >
                    <RefreshCcw size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
              {!isMobile ? (
                <>
                  <Button
                    variant="light"
                    color="blue"
                    size="compact-sm"
                    onClick={() => setQuickAddOpen(true)}
                    leftSection={<Plus size={16} strokeWidth={2} />}
                    style={{ marginBottom: "2px" }}
                    disabled={isReadOnly}
                  >
                    Quick add
                  </Button>
                  <Button
                    variant="light"
                    color="gray"
                    size="compact-sm"
                    onClick={() => globalThis.location.reload()}
                    leftSection={<RefreshCcw size={16} strokeWidth={2} />}
                    style={{ marginBottom: "2px" }}
                  >
                    Refresh
                  </Button>
                </>
              ) : null}
            </Group>
          </Group>
        </Paper>
        {isReadOnly ? (
          <Paper withBorder radius="md" p="sm" className="demo-banner">
            <Group gap="sm" align="center" wrap="nowrap">
              <ThemeIcon size={32} radius="md" variant="light" color="orange">
                <Info size={18} />
              </ThemeIcon>
              <Stack gap={2}>
                <Text fw={600}>Demo account</Text>
                <Text size="sm" c="dimmed">
                  This is a read-only preview. Changes are disabled to keep demo data intact.
                </Text>
              </Stack>
            </Group>
          </Paper>
        ) : null}
        <ReadOnlyProvider value={isReadOnly}>
          <div className="content">
            <Outlet />
          </div>
        </ReadOnlyProvider>
      </main>
      {isMobile ? (
        <nav className="mobile-nav" aria-label="Primary">
          {mobilePrimaryNavItems.map((item) => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `mobile-nav-item${isActive ? " active" : ""}`
              }
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </RouterNavLink>
          ))}
          <button
            type="button"
            className={`mobile-nav-item${
              mobileMoreOpen || isMobileOverflowActive ? " active" : ""
            }`}
            onClick={() => setMobileMoreOpen((current) => !current)}
            aria-label="Open more navigation"
            aria-haspopup="dialog"
            aria-expanded={mobileMoreOpen}
          >
            <span className="mobile-nav-icon">
              <MoreHorizontal size={20} />
            </span>
            <span className="mobile-nav-label">More</span>
          </button>
        </nav>
      ) : null}
      {isMobile ? (
        <button
          type="button"
          className="mobile-quick-add"
          onClick={() => setQuickAddOpen(true)}
          aria-label="Quick add"
          disabled={isReadOnly}
          aria-disabled={isReadOnly}
        >
          <Plus size={24} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
};
