import type { Category } from "../types/finance";

export const buildCategoryLookup = (categories: Category[]) =>
  new Map(categories.map((category) => [category.id, category]));

export const findRootCategoryId = (
  categoryId: string,
  lookup: Map<string, Category>
) => {
  const visited = new Set<string>();
  let current = lookup.get(categoryId);

  while (current?.parent_id && !visited.has(current.parent_id)) {
    const parent = lookup.get(current.parent_id);
    if (!parent || parent.type !== current.type) {
      break;
    }
    visited.add(current.parent_id);
    current = parent;
  }

  return current?.id ?? categoryId;
};

export const rollupCategoryTotals = (
  totals: Map<string, number>,
  lookup: Map<string, Category>
) => {
  const rolled = new Map<string, number>();

  totals.forEach((value, id) => {
    const rootId = findRootCategoryId(id, lookup);
    rolled.set(rootId, (rolled.get(rootId) ?? 0) + value);
  });

  return rolled;
};

export const buildCategoryDisplayMap = (
  categories: Category[],
  rollup: boolean
) => {
  const lookup = buildCategoryLookup(categories);
  const display = new Map<string, string>();

  categories.forEach((category) => {
    const rootId = rollup
      ? findRootCategoryId(category.id, lookup)
      : category.id;
    const rootName = lookup.get(rootId)?.name ?? category.name;
    display.set(category.id, rootName);
  });

  return display;
};
