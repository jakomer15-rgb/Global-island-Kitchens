/** A business rule was broken; `code` is safe to show (translated by the UI). */
export class RuleError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RuleError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

/** A short, loggable description of an unknown error (connection errors often have no message). */
export function reason(error: unknown): string {
  if (error instanceof Error) return error.message || (error as { code?: string }).code || error.name;
  return String(error);
}
