export type SavedFilter<T> = {
  id: string;
  name: string;
  value: T;
};

export const loadSavedFilters = <T>(key: string): SavedFilter<T>[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as SavedFilter<T>[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveSavedFilters = <T>(key: string, filters: SavedFilter<T>[]) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(filters));
  } catch {
    // ignore storage errors
  }
};
