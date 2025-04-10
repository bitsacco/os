import {
  FedimintReceiveFailureEvent,
  FedimintReceiveSuccessEvent,
  SwapStatusChangeEvent,
  WalletTxEvent,
} from '../events/types';
import { Logger } from '@nestjs/common';

const logger = new Logger('NotificationUtils');

export interface UserIdExtractorConfig {
  /**
   * Determines if invalid user IDs should throw an error or return null
   * Default: false (returns null on invalid)
   */
  throwOnInvalid?: boolean;

  /**
   * List of event fields to check for user IDs in order of preference
   * Default: ['userId', 'sub']
   */
  userIdFields?: string[];
}

/**
 * Extracts a user ID from various event types
 * @param event The event object
 * @param config Configuration options
 * @returns The extracted user ID or null if not found
 */
export function extractUserIdFromEvent(
  event: any,
  config: UserIdExtractorConfig = {},
): string | null {
  const { throwOnInvalid = false } = config;
  let userId: string | null = null;

  try {
    // Handle specific event types
    if (isFedimintEvent(event)) {
      // For Fedimint events, we need to handle special cases
      // The operationId might not be the userId, so we need to extract the actual userId
      userId = extractUserIdFromFedimintEvent(event);
    } else if (isSwapEvent(event)) {
      // For swap events, extract from the payload
      userId = extractUserIdFromSwapEvent(event);
    } else if (isWalletTxEvent(event)) {
      // For wallet transaction events
      userId = extractUserIdFromWalletTxEvent(event);
    } else if (isPlainObject(event)) {
      // Generic object - try to find userId or sub properties
      userId = extractUserIdFromGenericEvent(event, config.userIdFields);
    }

    // Validate the extracted userId
    if (userId) {
      userId = validateUserId(userId);
    }

    if (!userId && throwOnInvalid) {
      throw new Error(
        `Failed to extract valid user ID from event: ${JSON.stringify(event)}`,
      );
    }

    return userId;
  } catch (error) {
    logger.error(`Error extracting user ID: ${error.message}`, error.stack);

    if (throwOnInvalid) {
      throw error;
    }

    return null;
  }
}

/**
 * Validates a user ID format
 * @param userId The user ID to validate
 * @returns The validated user ID or null if invalid
 */
function validateUserId(userId: string): string | null {
  if (!userId || typeof userId !== 'string') {
    return null;
  }

  // At minimum, ensure userId is a non-empty string
  // You can add additional validation as needed
  if (userId.trim() === '') {
    return null;
  }

  return userId;
}

/**
 * Extracts a user ID from a Fedimint event
 */
function extractUserIdFromFedimintEvent(
  event: FedimintReceiveSuccessEvent | FedimintReceiveFailureEvent,
): string | null {
  // Here we need to map the operationId to an actual userId
  // This depends on your business logic - how operation IDs relate to user IDs
  // For now, we'll assume you have metadata in the operationId or context

  // Check if context contains user information
  if (event.context !== undefined && event.operationId) {
    // In a real implementation, you might need to parse the operationId
    // or query a database to get the actual user ID associated with this operation

    // For now, return operationId as a fallback
    return event.operationId;
  }

  return null;
}

/**
 * Extracts a user ID from a swap event
 */
function extractUserIdFromSwapEvent(
  event: SwapStatusChangeEvent,
): string | null {
  if (event.payload?.swapTracker) {
    // Similar to above, in a real implementation you might need to
    // query a database to get the user associated with this swap tracker

    // For now, return swapTracker as a fallback
    return event.payload.swapTracker;
  }

  return null;
}

/**
 * Extracts a user ID from a wallet transaction event
 */
function extractUserIdFromWalletTxEvent(event: WalletTxEvent): string | null {
  if (event.payload?.paymentTracker) {
    // Similar to above, in a real implementation you might need to
    // query a database to get the user associated with this payment tracker

    // For now, return paymentTracker as a fallback
    return event.payload.paymentTracker;
  }

  return null;
}

/**
 * Extracts a user ID from a generic event object
 */
function extractUserIdFromGenericEvent(
  event: Record<string, any>,
  userIdFields: string[] = ['userId', 'sub', 'user', 'id'],
): string | null {
  // Try each field in order until we find a non-empty value
  for (const field of userIdFields) {
    if (event[field] && typeof event[field] === 'string') {
      return event[field];
    }
  }

  return null;
}

// Type guards
function isFedimintEvent(
  event: any,
): event is FedimintReceiveSuccessEvent | FedimintReceiveFailureEvent {
  return (
    event &&
    typeof event === 'object' &&
    'operationId' in event &&
    'context' in event
  );
}

function isSwapEvent(event: any): event is SwapStatusChangeEvent {
  return (
    event &&
    typeof event === 'object' &&
    'payload' in event &&
    event.payload &&
    'swapTracker' in event.payload
  );
}

function isWalletTxEvent(event: any): event is WalletTxEvent {
  return (
    event &&
    typeof event === 'object' &&
    'payload' in event &&
    event.payload &&
    'paymentTracker' in event.payload
  );
}

function isPlainObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
