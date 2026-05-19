import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { APP_BASE_PATH, LOGIN_PATH, PUBLIC_HOME_PATH, appPath } from "./paths";

export type AppRouteDef = {
  key: string;
  path: string;
  fullPath: string;
  title: string;
  Component: LazyExoticComponent<ComponentType>;
};

export type NavItemDef = {
  path: string;
  label: string;
  description?: string;
};

const lazyNamedPage = <TModule, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  key: TKey
) =>
  lazy(async () => {
    const module = await loader();
    return { default: module[key] as ComponentType };
  });

export const LANDING_ROUTE: AppRouteDef = {
  key: "landing",
  path: PUBLIC_HOME_PATH,
  fullPath: PUBLIC_HOME_PATH,
  title: "CashCove",
  Component: lazyNamedPage(() => import("../pages/Landing"), "Landing"),
};

export const LOGIN_ROUTE: AppRouteDef = {
  key: "login",
  path: LOGIN_PATH,
  fullPath: LOGIN_PATH,
  title: "Login",
  Component: lazyNamedPage(() => import("../pages/Login"), "Login"),
};

export const APP_PAGE_ROUTES: AppRouteDef[] = [
  {
    key: "overview",
    path: "",
    fullPath: APP_BASE_PATH,
    title: "Overview",
    Component: lazyNamedPage(() => import("../pages/Dashboard"), "Dashboard"),
  },
  {
    key: "cashflow",
    path: "cashflow",
    fullPath: appPath("/cashflow"),
    title: "Cashflow",
    Component: lazyNamedPage(() => import("../pages/Cashflow"), "Cashflow"),
  },
  {
    key: "bills",
    path: "bills",
    fullPath: appPath("/bills"),
    title: "Bills",
    Component: lazyNamedPage(() => import("../pages/Bills"), "Bills"),
  },
  {
    key: "transactions",
    path: "transactions",
    fullPath: appPath("/transactions"),
    title: "Transactions",
    Component: lazyNamedPage(() => import("../pages/Transactions"), "Transactions"),
  },
  {
    key: "shared-spend",
    path: "shared-spend",
    fullPath: appPath("/shared-spend"),
    title: "Shared spend",
    Component: lazyNamedPage(() => import("../pages/SharedSpend"), "SharedSpend"),
  },
  {
    key: "subscriptions",
    path: "subscriptions",
    fullPath: appPath("/subscriptions"),
    title: "Subscriptions",
    Component: lazyNamedPage(
      () => import("../pages/Subscriptions"),
      "Subscriptions"
    ),
  },
  {
    key: "reports",
    path: "reports",
    fullPath: appPath("/reports"),
    title: "Reports",
    Component: lazyNamedPage(() => import("../pages/Reports"), "Reports"),
  },
  {
    key: "budgets",
    path: "budgets",
    fullPath: appPath("/budgets"),
    title: "Budgets",
    Component: lazyNamedPage(() => import("../pages/Budgets"), "Budgets"),
  },
  {
    key: "funds",
    path: "funds",
    fullPath: appPath("/funds"),
    title: "Funds",
    Component: lazyNamedPage(() => import("../pages/Funds"), "Funds"),
  },
  {
    key: "loans",
    path: "loans",
    fullPath: appPath("/loans"),
    title: "Loans",
    Component: lazyNamedPage(() => import("../pages/Loans"), "Loans"),
  },
  {
    key: "settings",
    path: "settings",
    fullPath: appPath("/settings"),
    title: "Settings",
    Component: lazyNamedPage(() => import("../pages/Settings"), "Settings"),
  },
  {
    key: "not-found",
    path: "*",
    fullPath: "*",
    title: "CashCove",
    Component: lazyNamedPage(() => import("../pages/NotFound"), "NotFound"),
  },
];

export const PUBLIC_NOT_FOUND_ROUTE: AppRouteDef = {
  key: "public-not-found",
  path: "*",
  fullPath: "*",
  title: "CashCove",
  Component: lazyNamedPage(() => import("../pages/NotFound"), "NotFound"),
};

export const ROUTE_TITLE_MAP = Object.fromEntries(
  APP_PAGE_ROUTES.filter((route) => route.fullPath !== "*").map((route) => [
    route.fullPath,
    route.title,
  ])
) as Record<string, string>;

export const DESKTOP_NAV_ITEMS: NavItemDef[] = [
  { path: APP_BASE_PATH, label: "Overview" },
  { path: appPath("/transactions"), label: "Transactions" },
  { path: appPath("/subscriptions"), label: "Subscriptions" },
  { path: appPath("/bills"), label: "Bills" },
  { path: appPath("/reports"), label: "Reports" },
  { path: appPath("/budgets"), label: "Budgets" },
  { path: appPath("/funds"), label: "Funds" },
  { path: appPath("/loans"), label: "Loans" },
  { path: appPath("/settings"), label: "Settings" },
];

export const MOBILE_PRIMARY_NAV_ITEMS: NavItemDef[] = [
  { path: APP_BASE_PATH, label: "Home" },
  { path: appPath("/transactions"), label: "Transactions" },
  { path: appPath("/bills"), label: "Bills" },
  { path: appPath("/budgets"), label: "Budgets" },
];

export const MOBILE_OVERFLOW_NAV_ITEMS: NavItemDef[] = [
  {
    path: appPath("/subscriptions"),
    label: "Subscriptions",
    description: "Recurring plans and renewals",
  },
  {
    path: appPath("/loans"),
    label: "Loans",
    description: "EMIs and lenders",
  },
  {
    path: appPath("/funds"),
    label: "Funds",
    description: "Goals and allocations",
  },
  {
    path: appPath("/reports"),
    label: "Reports",
    description: "Cashflow and exports",
  },
  {
    path: appPath("/settings"),
    label: "Settings",
    description: "Preferences and app setup",
  },
];

export const isNavItemActivePath = (currentPath: string, navPath: string) => {
  if (
    navPath === appPath("/reports") &&
    currentPath.startsWith(appPath("/cashflow"))
  ) {
    return true;
  }
  if (
    navPath === appPath("/transactions") &&
    currentPath === appPath("/shared-spend")
  ) {
    return true;
  }
  return currentPath === navPath || (navPath !== APP_BASE_PATH && currentPath.startsWith(navPath));
};
