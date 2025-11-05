import { RateLimitContext, RateLimitPreset, RateLimitStrategy } from './types';

/**
 * Predefined rate limit configurations for common scenarios
 */

/**
 * Authentication rate limiting presets
 */
export const AUTH_RATE_LIMITS: RateLimitPreset = {
  name: 'authentication',
  description: 'Rate limits for authentication operations',
  rules: [
    {
      key: `${RateLimitContext.AUTH}:login:burst`,
      limit: 5,
      windowSeconds: 60, // 1 minute
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage:
        'Too many login attempts. Please wait a moment and try again.',
    },
    {
      key: `${RateLimitContext.AUTH}:login:sustained`,
      limit: 20,
      windowSeconds: 900, // 15 minutes
      strategy: RateLimitStrategy.SLIDING_WINDOW,
      blockOnExceed: true,
      errorMessage:
        'Too many failed login attempts. Account temporarily locked.',
    },
    {
      key: `${RateLimitContext.AUTH}:register:burst`,
      limit: 3,
      windowSeconds: 60, // 1 minute
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Too many registration attempts. Please wait a moment.',
    },
    {
      key: `${RateLimitContext.AUTH}:register:daily`,
      limit: 10,
      windowSeconds: 86400, // 24 hours
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Daily registration limit exceeded.',
    },
    {
      key: `${RateLimitContext.AUTH}:verify:burst`,
      limit: 5,
      windowSeconds: 300, // 5 minutes
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Too many verification attempts. Please wait a moment.',
    },
    {
      key: `${RateLimitContext.AUTH}:otp:send`,
      limit: 3,
      windowSeconds: 600, // 10 minutes
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage:
        'Too many OTP requests. Please wait before requesting a new code.',
    },
  ],
};

/**
 * Withdrawal rate limiting presets
 */
export const WITHDRAWAL_RATE_LIMITS: RateLimitPreset = {
  name: 'withdrawal',
  description: 'Rate limits for withdrawal operations',
  rules: [
    {
      key: `${RateLimitContext.WITHDRAWAL}:request:burst`,
      limit: 20,
      windowSeconds: 10, // 10 seconds
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Too many withdrawal requests. Please slow down.',
    },
    {
      key: `${RateLimitContext.WITHDRAWAL}:request:minute`,
      limit: 10,
      windowSeconds: 60, // 1 minute
      strategy: RateLimitStrategy.SLIDING_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Too many withdrawal requests per minute.',
    },
    {
      key: `${RateLimitContext.WITHDRAWAL}:request:hourly`,
      limit: 50,
      windowSeconds: 3600, // 1 hour
      strategy: RateLimitStrategy.SLIDING_WINDOW,
      blockOnExceed: false, // Warn only
      errorMessage: 'Approaching hourly withdrawal request limit.',
    },
    {
      key: `${RateLimitContext.WITHDRAWAL}:process:burst`,
      limit: 5,
      windowSeconds: 10, // 10 seconds
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Too many withdrawal processing attempts.',
    },
    {
      key: `${RateLimitContext.WITHDRAWAL}:high_value:minute`,
      limit: 1,
      windowSeconds: 300, // 5 minutes
      strategy: RateLimitStrategy.FIXED_WINDOW,
      cost: 10, // High-value withdrawals cost more
      blockOnExceed: true,
      errorMessage:
        'High-value withdrawal rate limit. Please wait before next large withdrawal.',
    },
  ],
};

/**
 * Deposit rate limiting presets (for future use)
 */
export const DEPOSIT_RATE_LIMITS: RateLimitPreset = {
  name: 'deposit',
  description: 'Rate limits for deposit operations',
  rules: [
    {
      key: `${RateLimitContext.DEPOSIT}:request:burst`,
      limit: 30,
      windowSeconds: 10, // 10 seconds
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Too many deposit requests.',
    },
    {
      key: `${RateLimitContext.DEPOSIT}:request:minute`,
      limit: 20,
      windowSeconds: 60, // 1 minute
      strategy: RateLimitStrategy.SLIDING_WINDOW,
      blockOnExceed: false, // Warn only
    },
  ],
};

/**
 * Notification rate limiting presets (for future use)
 */
export const NOTIFICATION_RATE_LIMITS: RateLimitPreset = {
  name: 'notification',
  description: 'Rate limits for notification sending',
  rules: [
    {
      key: `${RateLimitContext.NOTIFICATION}:sms:hourly`,
      limit: 10,
      windowSeconds: 3600, // 1 hour
      strategy: RateLimitStrategy.TOKEN_BUCKET,
      burstLimit: 3,
      blockOnExceed: true,
      errorMessage: 'SMS rate limit exceeded.',
    },
    {
      key: `${RateLimitContext.NOTIFICATION}:nostr:hourly`,
      limit: 15,
      windowSeconds: 3600, // 1 hour
      strategy: RateLimitStrategy.TOKEN_BUCKET,
      burstLimit: 5,
      blockOnExceed: true,
      errorMessage: 'Nostr notification rate limit exceeded.',
    },
    {
      key: `${RateLimitContext.NOTIFICATION}:inapp:hourly`,
      limit: 50,
      windowSeconds: 3600, // 1 hour
      strategy: RateLimitStrategy.TOKEN_BUCKET,
      burstLimit: 10,
      blockOnExceed: false,
    },
  ],
};

/**
 * API rate limiting presets (for future use)
 */
export const API_RATE_LIMITS: RateLimitPreset = {
  name: 'api',
  description: 'Global API rate limits',
  rules: [
    {
      key: `${RateLimitContext.API}:global:burst`,
      limit: 100,
      windowSeconds: 10, // 10 seconds
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage: 'API rate limit exceeded.',
    },
    {
      key: `${RateLimitContext.API}:global:sustained`,
      limit: 1000,
      windowSeconds: 3600, // 1 hour
      strategy: RateLimitStrategy.SLIDING_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Hourly API rate limit exceeded.',
    },
    {
      key: `${RateLimitContext.API}:ip:minute`,
      limit: 60,
      windowSeconds: 60, // 1 minute
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Too many requests from this IP address.',
    },
  ],
};

/**
 * Chama wallet rate limiting presets
 */
export const CHAMA_RATE_LIMITS: RateLimitPreset = {
  name: 'chama',
  description: 'Rate limits for chama wallet operations',
  rules: [
    {
      key: `${RateLimitContext.CHAMA}:withdrawal:burst`,
      limit: 20,
      windowSeconds: 10, // 10 seconds
      strategy: RateLimitStrategy.FIXED_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Too many withdrawal requests. Please slow down.',
    },
    {
      key: `${RateLimitContext.CHAMA}:withdrawal:minute`,
      limit: 10,
      windowSeconds: 60, // 1 minute
      strategy: RateLimitStrategy.SLIDING_WINDOW,
      blockOnExceed: true,
      errorMessage: 'Too many withdrawal requests per minute.',
    },
  ],
};

/**
 * Get all available presets
 */
export const ALL_PRESETS: RateLimitPreset[] = [
  AUTH_RATE_LIMITS,
  WITHDRAWAL_RATE_LIMITS,
  DEPOSIT_RATE_LIMITS,
  NOTIFICATION_RATE_LIMITS,
  API_RATE_LIMITS,
  CHAMA_RATE_LIMITS,
];

/**
 * Helper to get preset by name
 */
export function getPresetByName(name: string): RateLimitPreset | undefined {
  return ALL_PRESETS.find((preset) => preset.name === name);
}

/**
 * Helper to get rules for a specific context
 */
export function getRulesForContext(context: RateLimitContext) {
  const preset = ALL_PRESETS.find((p) =>
    p.rules.some((r) => r.key.startsWith(context)),
  );
  return preset?.rules.filter((r) => r.key.startsWith(context)) || [];
}
