import type { TransactionRule } from "../types/finance";

type RuleInput = {
  merchant?: string | null;
  notes: string | null;
  type: "expense" | "income";
  category_id: string | null;
  account_id?: string | null;
  payment_method_id?: string | null;
  tags: string[];
};

type RuleOutput = {
  category_id: string | null;
  account_id: string | null;
  payment_method_id: string | null;
  tags: string[];
  merchant?: string | null;
  matchedRules?: TransactionRule[];
};

const normalize = (value: string) => value.trim().toLowerCase();

const matchesRule = (rule: TransactionRule, input: RuleInput) => {
  if (!rule.is_active) {
    return false;
  }
  if (rule.transaction_type !== "any" && rule.transaction_type !== input.type) {
    return false;
  }
  const candidates = [input.merchant, input.notes]
    .map((value) => (value ? normalize(value) : ""))
    .filter(Boolean);
  if (candidates.length === 0) {
    return false;
  }
  const needle = normalize(rule.match_text);
  if (!needle) {
    return false;
  }
  if (rule.match_type === "equals") {
    return candidates.some((candidate) => candidate === needle);
  }
  if (rule.match_type === "starts_with") {
    return candidates.some((candidate) => candidate.startsWith(needle));
  }
  if (rule.match_type === "ends_with") {
    return candidates.some((candidate) => candidate.endsWith(needle));
  }
  if (rule.match_type === "regex") {
    try {
      const regex = new RegExp(rule.match_text, "i");
      const unnormalizedCandidates = [input.merchant, input.notes].filter(
        (v): v is string => Boolean(v),
      );
      return unnormalizedCandidates.some((candidate) => regex.test(candidate));
    } catch {
      // Invalid regex, treat as no match
      return false;
    }
  }
  return candidates.some((candidate) => candidate.includes(needle));
};

const sortRules = (rules: TransactionRule[]) =>
  [...rules].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.name.localeCompare(b.name);
  });

export const applyRulesToTransaction = (
  input: RuleInput,
  rules: TransactionRule[],
): RuleOutput => {
  const preview = previewRules(input, rules);
  return {
    category_id: preview.category_id,
    account_id: preview.account_id,
    payment_method_id: preview.payment_method_id,
    tags: preview.tags,
    merchant: preview.merchant,
  };
};

export const previewRules = (
  input: RuleInput,
  rules: TransactionRule[],
): RuleOutput => {
  let nextCategory = input.category_id;
  let nextAccount = input.account_id ?? null;
  let nextPaymentMethod = input.payment_method_id ?? null;
  let nextMerchant = input.merchant;
  const tags = new Set(input.tags.map((tag) => normalize(tag)));
  const matchedRules: TransactionRule[] = [];

  sortRules(rules).forEach((rule) => {
    if (!matchesRule(rule, input)) {
      return;
    }
    matchedRules.push(rule);
    if (!nextCategory && rule.category_id) {
      nextCategory = rule.category_id;
    }
    if (!nextAccount && rule.account_id) {
      nextAccount = rule.account_id;
    }
    if (!nextPaymentMethod && rule.payment_method_id) {
      nextPaymentMethod = rule.payment_method_id;
    }
    if (
      (!nextMerchant || nextMerchant === input.merchant) &&
      rule.new_merchant_name
    ) {
      nextMerchant = rule.new_merchant_name;
    }
    rule.tag_names.forEach((tag) => {
      const cleaned = normalize(tag);
      if (cleaned) {
        tags.add(cleaned);
      }
    });
  });

  return {
    category_id: nextCategory,
    account_id: nextAccount,
    payment_method_id: nextPaymentMethod,
    tags: Array.from(tags),
    merchant: nextMerchant,
    matchedRules,
  };
};
