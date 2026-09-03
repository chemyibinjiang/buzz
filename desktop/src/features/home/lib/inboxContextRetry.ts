import {
  activateRateLimit,
  isRateLimited,
  parseRateLimitHint,
  waitForRateLimit,
} from "@/shared/api/relayRateLimitGate";

const RATE_LIMIT_PREFIX = "relay rate-limited:";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";
}

/** Retry a cold Inbox context read after relay HTTP back-pressure clears. */
export async function retryInboxContextRead<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  const attempts = Math.max(1, maxAttempts);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const message = errorMessage(error);
      if (!message.startsWith(RATE_LIMIT_PREFIX) || attempt === attempts) {
        throw error;
      }
      if (!isRateLimited()) {
        activateRateLimit(parseRateLimitHint(message));
      }
      await waitForRateLimit();
    }
  }
  throw new Error("Unreachable Inbox context retry state");
}
