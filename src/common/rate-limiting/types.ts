/**
 * Rate limiting types and interfaces for unified rate limiting service
 */

/**
 * Rate limiting strategy types
 */
export enum RateLimitStrategy {
  /** Fixed window - resets at fixed intervals */
  FIXED_WINDOW = 'FIXED_WINDOW',
  /** Sliding window - more accurate but more expensive */
  SLIDING_WINDOW = 'SLIDING_WINDOW',
  /** Token bucket - allows bursts with refill rate */
  TOKEN_BUCKET = 'TOKEN_BUCKET',
}

/**
 * Rate limiting context for different use cases
 */
export enum RateLimitContext {
  /** Authentication operations (login, register, verify) */
  AUTH = 'auth',
  /** Withdrawal operations (request, process) */
  WITHDRAWAL = 'withdrawal',
  /** Deposit operations */
  DEPOSIT = 'deposit',
  /** Notification sending */
  NOTIFICATION = 'notification',
  /** API calls */
  API = 'api',
  /** Admin operations */
  ADMIN = 'admin',
  /** Chama wallet operations */
  CHAMA = 'chama',
}

/**
 * Configuration for a rate limit rule
 */
export interface RateLimitConfig {
  /** Unique identifier for this rule */
  key: string;

  /** Maximum number of requests allowed */
  limit: number;

  /** Time window in seconds */
  windowSeconds: number;

  /** Strategy to use for rate limiting */
  strategy: RateLimitStrategy;

  /** Optional burst allowance (for TOKEN_BUCKET) */
  burstLimit?: number;

  /** Optional cost multiplier for different operations */
  cost?: number;

  /** Whether to block on exceed or just warn */
  blockOnExceed: boolean;

  /** Custom error message */
  errorMessage?: string;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Number of remaining requests in current window */
  remaining: number;

  /** When the current window resets */
  resetAt: Date;

  /** Current limit that was checked */
  limit: number;

  /** Reason for rejection (if not allowed) */
  reason?: string;

  /** Suggested retry after duration in seconds */
  retryAfter?: number;

  /** Additional metadata */
  metadata?: {
    /** Current count in window */
    current: number;
    /** Strategy used */
    strategy: RateLimitStrategy;
    /** Context */
    context: RateLimitContext;
  };
}

/**
 * Rate limit action/operation identifier
 */
export interface RateLimitAction {
  /** Context (auth, withdrawal, etc.) */
  context: RateLimitContext;

  /** Specific action within context */
  action: string;

  /** Entity ID (user ID, chama ID, IP address, etc.) */
  entityId: string;

  /** Optional entity type for logging */
  entityType?: string;
}

/**
 * Storage backend interface for rate limiting
 */
export interface RateLimitStorage {
  /**
   * Get current count for a key
   */
  get(key: string): Promise<number | null>;

  /**
   * Increment count for a key
   */
  increment(key: string, ttl: number): Promise<number>;

  /**
   * Increment count by a specific amount (for cost-based rate limiting)
   */
  incrementBy(key: string, amount: number, ttl: number): Promise<number>;

  /**
   * Set value for a key with TTL
   */
  set(key: string, value: number, ttl: number): Promise<void>;

  /**
   * Delete a key
   */
  delete(key: string): Promise<void>;

  /**
   * Get multiple keys at once
   */
  mget(keys: string[]): Promise<(number | null)[]>;

  /**
   * Check if storage is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Preset rate limit configurations
 */
export interface RateLimitPreset {
  /** Preset name */
  name: string;

  /** Description */
  description: string;

  /** Rules for this preset */
  rules: RateLimitConfig[];
}

/**
 * Rate limit event for monitoring
 */
export interface RateLimitEvent {
  /** Event type */
  type: 'limit_exceeded' | 'limit_warning' | 'limit_reset';

  /** Action that triggered the event */
  action: RateLimitAction;

  /** Result of the check */
  result: RateLimitResult;

  /** Timestamp */
  timestamp: Date;

  /** Additional context */
  metadata?: Record<string, any>;
}
