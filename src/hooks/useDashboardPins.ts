import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "cashcove:dashboard:pinnedCards";

type UseDashboardPinsArgs = {
  availableIds: string[];
  defaultPins: string[];
};

const sanitizePins = (pins: string[], availableIds: string[]) =>
  pins.filter((id) => availableIds.includes(id));

const loadPins = (availableIds: string[], defaultPins: string[]) => {
  if (typeof window === "undefined") {
    return defaultPins;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultPins;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaultPins;
    }
    const sanitized = sanitizePins(parsed, availableIds);
    return sanitized.length > 0 ? sanitized : defaultPins;
  } catch {
    return defaultPins;
  }
};

export const useDashboardPins = ({
  availableIds,
  defaultPins,
}: UseDashboardPinsArgs) => {
  const safeDefaults = useMemo(
    () => sanitizePins(defaultPins, availableIds),
    [availableIds, defaultPins]
  );
  const [pinned, setPinned] = useState(() =>
    loadPins(availableIds, safeDefaults)
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
    } catch {
      // Ignore storage errors (e.g., storage disabled).
    }
  }, [pinned]);

  const isPinned = useCallback(
    (id: string) => pinned.includes(id),
    [pinned]
  );

  const togglePin = useCallback((id: string) => {
    setPinned((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const resetPins = useCallback(() => {
    setPinned(safeDefaults);
  }, [safeDefaults]);

  return {
    pinned,
    isPinned,
    togglePin,
    resetPins,
  };
};
