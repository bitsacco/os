export interface SimpleRetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: SimpleRetryConfig,
  isRetryableError?: (error: Error) => boolean,
): Promise<T> {
  const { maxAttempts, delayMs, backoffMultiplier = 2 } = config;
  let lastError: Error;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Check if error is retryable
      if (isRetryableError && !isRetryableError(lastError)) {
        break;
      }

      // Default retry logic for common transient errors
      const errorMessage = lastError.message?.toLowerCase() || '';
      const isTransientError =
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('network') ||
        errorMessage.includes('temporarily unavailable') ||
        errorMessage.includes('service unavailable') ||
        errorMessage.includes('payment failed');

      if (!isRetryableError && !isTransientError) {
        break;
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    }
  }

  throw lastError;
}

export const RETRY_CONFIGS = {
  LIGHTNING: { maxAttempts: 3, delayMs: 2000, backoffMultiplier: 2 },
  EXTERNAL_API: { maxAttempts: 2, delayMs: 1000, backoffMultiplier: 1.5 },
  DATABASE: { maxAttempts: 2, delayMs: 500, backoffMultiplier: 2 },
};
