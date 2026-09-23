/**
 * Typed application errors. Every API response and page error path funnels
 * through these so users see consistent, actionable messages.
 */

export type AppErrorCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "NO_PROVIDERS"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  INVALID_INPUT: 400,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  NO_PROVIDERS: 503,
  UPSTREAM_ERROR: 502,
  TIMEOUT: 504,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly retryAfterSeconds?: number;

  constructor(
    code: AppErrorCode,
    message: string,
    opts: { details?: Record<string, unknown>; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = opts.details;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
      ...(this.retryAfterSeconds ? { retryAfterSeconds: this.retryAfterSeconds } : {}),
    };
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Coerce any thrown value into an AppError without leaking internals. */
export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  if (e instanceof Error && e.name === "AbortError") {
    return new AppError("TIMEOUT", "A data source took too long to respond.", { cause: e });
  }
  return new AppError("INTERNAL", "Something went wrong assembling this profile.", { cause: e });
}

/** Race a promise against a timeout. */
export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError("TIMEOUT", `${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
