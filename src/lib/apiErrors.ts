type ErrorLike = { message?: string; code?: string } | null | undefined;

const READ_ONLY_MESSAGES = new Set(["Read-only account"]);

export const normalizeApiErrorMessage = (error: ErrorLike) => {
  const message = error?.message ?? "Something went wrong.";
  const code = error?.code;
  if (code === "P0001" || READ_ONLY_MESSAGES.has(message)) {
    return "Demo account is read-only. Changes are disabled.";
  }
  return message;
};
