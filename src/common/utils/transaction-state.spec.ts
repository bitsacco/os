import { TransactionStatus, ChamaTxStatus } from '../types';
import {
  SOLO_WALLET_STATE_TRANSITIONS,
  CHAMA_WALLET_STATE_TRANSITIONS,
  isValidSoloWalletTransition,
  isValidChamaWalletTransition,
  validateStateTransition,
  getAllowedNextStates,
} from './transaction-state';

describe('Transaction State Machine', () => {
  describe('Solo Wallet State Transitions', () => {
    it('should allow valid transitions from PENDING', () => {
      expect(
        isValidSoloWalletTransition(
          TransactionStatus.PENDING,
          TransactionStatus.PROCESSING,
        ),
      ).toBe(true);

      expect(
        isValidSoloWalletTransition(
          TransactionStatus.PENDING,
          TransactionStatus.COMPLETE,
        ),
      ).toBe(true);

      expect(
        isValidSoloWalletTransition(
          TransactionStatus.PENDING,
          TransactionStatus.FAILED,
        ),
      ).toBe(true);
    });

    it('should allow valid transitions from PROCESSING', () => {
      expect(
        isValidSoloWalletTransition(
          TransactionStatus.PROCESSING,
          TransactionStatus.COMPLETE,
        ),
      ).toBe(true);

      expect(
        isValidSoloWalletTransition(
          TransactionStatus.PROCESSING,
          TransactionStatus.FAILED,
        ),
      ).toBe(true);

      // Should allow reverting to PENDING on payment failure
      expect(
        isValidSoloWalletTransition(
          TransactionStatus.PROCESSING,
          TransactionStatus.PENDING,
        ),
      ).toBe(true);
    });

    it('should not allow transitions from final states', () => {
      expect(
        isValidSoloWalletTransition(
          TransactionStatus.COMPLETE,
          TransactionStatus.PENDING,
        ),
      ).toBe(false);

      expect(
        isValidSoloWalletTransition(
          TransactionStatus.FAILED,
          TransactionStatus.COMPLETE,
        ),
      ).toBe(false);
    });

    it('should not allow invalid transitions', () => {
      // Cannot go from PENDING to PENDING
      expect(
        isValidSoloWalletTransition(
          TransactionStatus.PENDING,
          TransactionStatus.PENDING,
        ),
      ).toBe(false);

      // Cannot go from COMPLETE to anything
      expect(
        isValidSoloWalletTransition(
          TransactionStatus.COMPLETE,
          TransactionStatus.PROCESSING,
        ),
      ).toBe(false);
    });
  });

  describe('Chama Wallet State Transitions', () => {
    it('should allow valid transitions from PENDING', () => {
      expect(
        isValidChamaWalletTransition(
          ChamaTxStatus.PENDING,
          ChamaTxStatus.APPROVED,
        ),
      ).toBe(true);

      expect(
        isValidChamaWalletTransition(
          ChamaTxStatus.PENDING,
          ChamaTxStatus.REJECTED,
        ),
      ).toBe(true);
    });

    it('should allow valid transitions from APPROVED', () => {
      expect(
        isValidChamaWalletTransition(
          ChamaTxStatus.APPROVED,
          ChamaTxStatus.PROCESSING,
        ),
      ).toBe(true);

      expect(
        isValidChamaWalletTransition(
          ChamaTxStatus.APPROVED,
          ChamaTxStatus.COMPLETE,
        ),
      ).toBe(true);
    });

    it('should not allow skipping approval', () => {
      expect(
        isValidChamaWalletTransition(
          ChamaTxStatus.PENDING,
          ChamaTxStatus.PROCESSING,
        ),
      ).toBe(false);

      expect(
        isValidChamaWalletTransition(
          ChamaTxStatus.PENDING,
          ChamaTxStatus.COMPLETE,
        ),
      ).toBe(false);
    });
  });

  describe('validateStateTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() =>
        validateStateTransition(
          TransactionStatus.PENDING,
          TransactionStatus.PROCESSING,
          SOLO_WALLET_STATE_TRANSITIONS,
          'test',
        ),
      ).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() =>
        validateStateTransition(
          TransactionStatus.COMPLETE,
          TransactionStatus.PENDING,
          SOLO_WALLET_STATE_TRANSITIONS,
          'test',
        ),
      ).toThrow('Invalid test state transition from 3 to 0');
    });

    it('should include allowed transitions in error message', () => {
      expect(() =>
        validateStateTransition(
          TransactionStatus.PENDING,
          TransactionStatus.PENDING,
          SOLO_WALLET_STATE_TRANSITIONS,
          'test',
        ),
      ).toThrow('Allowed transitions: 1, 3, 2');
    });
  });

  describe('getAllowedNextStates', () => {
    it('should return allowed next states', () => {
      const allowed = getAllowedNextStates(
        TransactionStatus.PENDING,
        SOLO_WALLET_STATE_TRANSITIONS,
      );

      expect(allowed).toContain(TransactionStatus.PROCESSING);
      expect(allowed).toContain(TransactionStatus.COMPLETE);
      expect(allowed).toContain(TransactionStatus.FAILED);
      expect(allowed).toHaveLength(3);
    });

    it('should return empty array for final states', () => {
      const allowed = getAllowedNextStates(
        TransactionStatus.COMPLETE,
        SOLO_WALLET_STATE_TRANSITIONS,
      );

      expect(allowed).toHaveLength(0);
    });
  });
});
