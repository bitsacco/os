/**
 * Permission String Validation Constants
 *
 * These constants are used to validate permission strings throughout
 * the permission system to prevent NoSQL injection and ensure consistent
 * permission format.
 */

/**
 * Full permission regex - validates complete permission strings
 * Matches:
 * - * (superuser)
 * - admin:* (category wildcard)
 * - user:read:own (specific permission)
 * - user:read (action permission)
 */
export const PERMISSION_REGEX = {
  FULL: /^(\*|[a-z]+:\*|[a-z]+:[a-z_]+(?::[a-z_]+)?)$/,
  PARTIAL: /^[a-z]+:[a-z_]+(?::[a-z_]+)?$/,
} as const;

/**
 * Resource ID validation regex
 * Supports MongoDB ObjectId and UUID formats
 */
export const RESOURCE_ID_REGEX =
  /^[0-9a-f]{24}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permission categories supported by the system
 */
export const PERMISSION_CATEGORIES = {
  USER: 'user',
  CHAMA: 'chama',
  WALLET: 'wallet',
  TRANSACTION: 'transaction',
  PERSONAL: 'personal',
  SHARES: 'shares',
  NOTIFICATION: 'notification',
  ADMIN: 'admin',
  LNURL: 'lnurl',
  SMS: 'sms',
  NOSTR: 'nostr',
  APIKEY: 'apikey',
} as const;

/**
 * Maximum length for audit log reason field
 */
export const MAX_AUDIT_REASON_LENGTH = 500;

/**
 * Permission string validation error messages
 */
export const PERMISSION_VALIDATION_ERRORS = {
  INVALID_FORMAT: 'Invalid permission format',
  UNKNOWN_PERMISSION: 'Unknown permission',
  INVALID_RESOURCE_ID: 'Invalid resource ID format',
} as const;
