import { describe, expect, it } from "vitest";
import { APP_BASE_PATH, LOGIN_PATH, PUBLIC_HOME_PATH, appPath } from "./paths";
import {
  APP_PAGE_ROUTES,
  DESKTOP_NAV_ITEMS,
  LANDING_ROUTE,
  LOGIN_ROUTE,
  MOBILE_OVERFLOW_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
  PUBLIC_NOT_FOUND_ROUTE,
  ROUTE_TITLE_MAP,
  isNavItemActivePath,
} from "./routes";

describe("app route registry", () => {
  it("keeps the declared page routes stable", () => {
    expect(LANDING_ROUTE.fullPath).toBe(PUBLIC_HOME_PATH);
    expect(LOGIN_ROUTE.fullPath).toBe(LOGIN_PATH);
    expect(PUBLIC_NOT_FOUND_ROUTE.path).toBe("*");
    expect(APP_PAGE_ROUTES.map((route) => route.fullPath)).toEqual([
      APP_BASE_PATH,
      appPath("/cashflow"),
      appPath("/bills"),
      appPath("/transactions"),
      appPath("/shared-spend"),
      appPath("/subscriptions"),
      appPath("/reports"),
      appPath("/budgets"),
      appPath("/funds"),
      appPath("/loans"),
      appPath("/settings"),
      "*",
    ]);
  });

  it("does not declare duplicate protected routes", () => {
    const routePaths = APP_PAGE_ROUTES.map((route) => route.fullPath);
    expect(new Set(routePaths).size).toBe(routePaths.length);
  });

  it("keeps route titles in sync for all concrete pages", () => {
    const titledPaths = APP_PAGE_ROUTES.filter((route) => route.fullPath !== "*");
    expect(Object.keys(ROUTE_TITLE_MAP)).toEqual(titledPaths.map((route) => route.fullPath));
    expect(
      titledPaths.every((route) => ROUTE_TITLE_MAP[route.fullPath] === route.title)
    ).toBe(true);
  });
});

describe("app navigation registry", () => {
  it("points desktop and mobile nav items only at declared routes", () => {
    const routePaths = new Set(
      APP_PAGE_ROUTES.filter((route) => route.fullPath !== "*").map((route) => route.fullPath)
    );
    const navPaths = [
      ...DESKTOP_NAV_ITEMS,
      ...MOBILE_PRIMARY_NAV_ITEMS,
      ...MOBILE_OVERFLOW_NAV_ITEMS,
    ].map((item) => item.path);

    expect(navPaths.every((path) => routePaths.has(path))).toBe(true);
  });

  it("keeps mobile navigation coverage aligned with desktop destinations", () => {
    const desktopPaths = DESKTOP_NAV_ITEMS.map((item) => item.path).sort();
    const mobilePaths = [
      ...MOBILE_PRIMARY_NAV_ITEMS.map((item) => item.path),
      ...MOBILE_OVERFLOW_NAV_ITEMS.map((item) => item.path),
    ].sort();

    expect(mobilePaths).toEqual(desktopPaths);
  });

  it("preserves the special active-route aliases used in the shell", () => {
    expect(isNavItemActivePath(appPath("/reports"), appPath("/reports"))).toBe(true);
    expect(isNavItemActivePath(appPath("/cashflow"), appPath("/reports"))).toBe(true);
    expect(isNavItemActivePath(appPath("/shared-spend"), appPath("/transactions"))).toBe(
      true
    );
    expect(isNavItemActivePath(appPath("/settings"), appPath("/reports"))).toBe(false);
    expect(isNavItemActivePath(appPath("/transactions"), APP_BASE_PATH)).toBe(false);
  });
});
