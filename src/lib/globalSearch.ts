const normalizeWhitespace = /\s+/g;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeSearchText = (value: string) =>
  value.trim().toLowerCase().replace(normalizeWhitespace, " ");

export const tokenizeSearchText = (value: string) =>
  normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

const hasWordBoundaryMatch = (field: string, token: string) =>
  new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(token)}`).test(field);

type ScoreSearchMatchArgs = {
  query: string;
  primaryText: string;
  aliasTexts?: string[];
  valueTexts?: string[];
};

export const scoreSearchMatch = ({
  query,
  primaryText,
  aliasTexts = [],
  valueTexts = [],
}: ScoreSearchMatchArgs) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedPrimary = normalizeSearchText(primaryText);
  const fields = [normalizedPrimary, ...aliasTexts, ...valueTexts]
    .map((field) => normalizeSearchText(field))
    .filter(Boolean);

  if (!normalizedQuery) {
    return fields.length > 0 ? 1 : null;
  }

  if (fields.length === 0) {
    return null;
  }

  const tokens = tokenizeSearchText(normalizedQuery);
  let score = 0;

  for (const token of tokens) {
    if (normalizedPrimary === token) {
      score += 120;
      continue;
    }
    if (normalizedPrimary.startsWith(token)) {
      score += 90;
      continue;
    }
    if (fields.some((field) => hasWordBoundaryMatch(field, token))) {
      score += 60;
      continue;
    }
    if (fields.some((field) => field.includes(token))) {
      score += 30;
      continue;
    }
    return null;
  }

  if (normalizedPrimary === normalizedQuery) {
    score += 160;
  } else if (normalizedPrimary.startsWith(normalizedQuery)) {
    score += 100;
  } else if (fields.some((field) => hasWordBoundaryMatch(field, normalizedQuery))) {
    score += 70;
  } else if (fields.some((field) => field.includes(normalizedQuery))) {
    score += 40;
  }

  return score;
};
