export type ApiError = { message: string };

export type DeleteByIdInput = { id: string };

export type MonthArgs = { month: string };
export type RangeArgs = { start: string; end: string };

export type TagsArgs = { transactionId: string; tags: string[] };
