import { TransactionStatus, ChamaTxStatus } from '../types';

/**
 * Valid state transitions for solo wallet transactions
 */
export const SOLO_WALLET_STATE_TRANSITIONS: Record<
  TransactionStatus,
  TransactionStatus[]
> = {
  [TransactionStatus.PENDING]: [
    TransactionStatus.PROCESSING,
    TransactionStatus.COMPLETE,
    TransactionStatus.FAILED,
    TransactionStatus.MANUAL_REVIEW,
  ],
  [TransactionStatus.PROCESSING]: [
    TransactionStatus.COMPLETE,
    TransactionStatus.FAILED,
    TransactionStatus.PENDING, // Allow reverting to pending on payment failure
    TransactionStatus.MANUAL_REVIEW,
  ],
  [TransactionStatus.MANUAL_REVIEW]: [TransactionStatus.UNRECOGNIZED],
  [TransactionStatus.COMPLETE]: [], // Final state - no transitions allowed
  [TransactionStatus.FAILED]: [], // Final state - no transitions allowed
  [TransactionStatus.UNRECOGNIZED]: [], // Final state - no transitions allowed
};

/**
 * Valid state transitions for chama wallet transactions
 */
export const CHAMA_WALLET_STATE_TRANSITIONS: Record<
  ChamaTxStatus,
  ChamaTxStatus[]
> = {
  [ChamaTxStatus.PENDING]: [
    ChamaTxStatus.APPROVED,
    ChamaTxStatus.REJECTED,
    ChamaTxStatus.FAILED,
    ChamaTxStatus.MANUAL_REVIEW,
  ],
  [ChamaTxStatus.APPROVED]: [
    ChamaTxStatus.PROCESSING,
    ChamaTxStatus.COMPLETE,
    ChamaTxStatus.FAILED,
    ChamaTxStatus.MANUAL_REVIEW,
  ],
  [ChamaTxStatus.PROCESSING]: [
    ChamaTxStatus.COMPLETE,
    ChamaTxStatus.FAILED,
    ChamaTxStatus.APPROVED, // Allow reverting to approved on payment failure
    ChamaTxStatus.MANUAL_REVIEW,
  ],
  [ChamaTxStatus.MANUAL_REVIEW]: [ChamaTxStatus.UNRECOGNIZED],
  [ChamaTxStatus.COMPLETE]: [], // Final state - no transitions allowed
  [ChamaTxStatus.REJECTED]: [], // Final state - no transitions allowed
  [ChamaTxStatus.FAILED]: [], // Final state - no transitions allowed
  [ChamaTxStatus.UNRECOGNIZED]: [], // Final state - no transitions allowed
};

/**
 * Validates if a state transition is allowed
 */
export function isValidTransition<T extends TransactionStatus | ChamaTxStatus>(
  currentState: T,
  newState: T,
  transitions: Record<T, T[]>,
): boolean {
  const allowedTransitions = transitions[currentState] || [];
  return allowedTransitions.includes(newState);
}

/**
 * Validates solo wallet transaction state transition
 */
export function isValidSoloWalletTransition(
  currentState: TransactionStatus,
  newState: TransactionStatus,
): boolean {
  return isValidTransition(
    currentState,
    newState,
    SOLO_WALLET_STATE_TRANSITIONS,
  );
}

/**
 * Validates chama wallet transaction state transition
 */
export function isValidChamaWalletTransition(
  currentState: ChamaTxStatus,
  newState: ChamaTxStatus,
): boolean {
  return isValidTransition(
    currentState,
    newState,
    CHAMA_WALLET_STATE_TRANSITIONS,
  );
}

/**
 * Get allowed next states for a given state
 */
export function getAllowedNextStates<
  T extends TransactionStatus | ChamaTxStatus,
>(currentState: T, transitions: Record<T, T[]>): T[] {
  return transitions[currentState] || [];
}

/**
 * Throws an error if the state transition is invalid
 */
export function validateStateTransition<
  T extends TransactionStatus | ChamaTxStatus,
>(
  currentState: T,
  newState: T,
  transitions: Record<T, T[]>,
  entityType: string,
): void {
  if (!isValidTransition(currentState, newState, transitions)) {
    const allowed = getAllowedNextStates(currentState, transitions);
    throw new Error(
      `Invalid ${entityType} state transition from ${currentState} to ${newState}. ` +
        `Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (final state)'}`,
    );
  }
}
