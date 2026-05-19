export type CategoryInsightItem = {
  id: string;
  name: string;
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
  ratio: number | null;
};

export type CategoryInsights = {
  totalCurrent: number;
  totalPrevious: number;
  totalDelta: number;
  totalPercent: number | null;
  movers: CategoryInsightItem[];
  outliers: CategoryInsightItem[];
};

const clampSpend = (value: number | undefined) => Math.max(0, value ?? 0);

const buildInsightItem = (
  id: string,
  current: number,
  previous: number,
  name: string
): CategoryInsightItem => {
  const delta = current - previous;
  const percent = previous > 0 ? delta / previous : null;
  const ratio = previous > 0 ? current / previous : null;
  return {
    id,
    name,
    current,
    previous,
    delta,
    percent,
    ratio,
  };
};

export const buildCategoryInsights = ({
  currentTotals,
  previousTotals,
  categoryMap,
  maxItems = 3,
}: {
  currentTotals: Map<string, number>;
  previousTotals: Map<string, number>;
  categoryMap: Map<string, string>;
  maxItems?: number;
}): CategoryInsights => {
  const ids = new Set<string>([...currentTotals.keys(), ...previousTotals.keys()]);
  const items = Array.from(ids)
    .map((id) => {
      const current = clampSpend(currentTotals.get(id));
      const previous = clampSpend(previousTotals.get(id));
      if (current === 0 && previous === 0) {
        return null;
      }
      const name = categoryMap.get(id) ?? "Uncategorized";
      return buildInsightItem(id, current, previous, name);
    })
    .filter((item): item is CategoryInsightItem => Boolean(item));

  const totalCurrent = items.reduce((sum, item) => sum + item.current, 0);
  const totalPrevious = items.reduce((sum, item) => sum + item.previous, 0);
  const totalDelta = totalCurrent - totalPrevious;
  const totalPercent = totalPrevious > 0 ? totalDelta / totalPrevious : null;

  const minMoverDelta = Math.max(100, totalCurrent * 0.01);
  const movers = items
    .filter((item) => Math.abs(item.delta) >= minMoverDelta)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, maxItems);

  const outlierThreshold = Math.max(500, totalCurrent * 0.05);
  const outliers = items
    .filter((item) => {
      if (item.current <= 0) {
        return false;
      }
      if (item.previous <= 0) {
        return item.current >= outlierThreshold;
      }
      return item.current >= item.previous * 1.5 && item.delta >= outlierThreshold;
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, maxItems);

  return {
    totalCurrent,
    totalPrevious,
    totalDelta,
    totalPercent,
    movers,
    outliers,
  };
};
