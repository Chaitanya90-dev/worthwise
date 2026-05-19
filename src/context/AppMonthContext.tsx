/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import dayjs from "dayjs";
import { formatMonthLabel } from "../lib/format";

type AppMonthContextValue = {
  month: string;
  setMonth: (value: string) => void;
  monthLabel: string;
};

const AppMonthContext = createContext<AppMonthContextValue | null>(null);
const STORAGE_KEY = "cashcove:month";
const getCurrentMonth = () => dayjs().format("YYYY-MM");

const isValidMonth = (value: string) => dayjs(value + "-01").isValid();

const loadInitialMonth = () => {
  const currentMonth = getCurrentMonth();
  if (typeof globalThis === "undefined") {
    return currentMonth;
  }
  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    if (stored && isValidMonth(stored)) {
      const normalized = dayjs(stored + "-01").format("YYYY-MM");
      // Never reopen into a stale month from storage.
      return normalized === currentMonth ? normalized : currentMonth;
    }
  } catch {
    // ignore storage errors
  }
  return currentMonth;
};

export const AppMonthProvider = ({ children }: { children: ReactNode }) => {
  const [month, setMonthState] = useState(loadInitialMonth);
  const [followCurrentMonth, setFollowCurrentMonth] = useState(
    () => loadInitialMonth() === getCurrentMonth()
  );
  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);

  const setMonth = (value: string) => {
    const normalized = isValidMonth(value)
      ? dayjs(value + "-01").format("YYYY-MM")
      : getCurrentMonth();
    setMonthState(normalized);
    setFollowCurrentMonth(normalized === getCurrentMonth());
  };

  useEffect(() => {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, month);
    } catch {
      // ignore storage errors
    }
  }, [month]);

  useEffect(() => {
    if (!followCurrentMonth) {
      return;
    }
    const now = dayjs();
    const nextMonthStart = now.endOf("month").add(1, "millisecond");
    const delay = Math.max(1000, nextMonthStart.diff(now));
    const timer = globalThis.setTimeout(() => {
      const current = getCurrentMonth();
      setMonthState(current);
      setFollowCurrentMonth(true);
    }, delay);
    return () => globalThis.clearTimeout(timer);
  }, [followCurrentMonth, month]);

  return (
    <AppMonthContext.Provider value={{ month, setMonth, monthLabel }}>
      {children}
    </AppMonthContext.Provider>
  );
};

export const useAppMonth = () => {
  const context = useContext(AppMonthContext);
  if (!context) {
    throw new Error("useAppMonth must be used within AppMonthProvider");
  }
  return context;
};
