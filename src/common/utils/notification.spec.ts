import { extractUserIdFromEvent } from './notification';
import { FedimintContext, SwapContext, WalletTxContext } from '../events/types';
import { TransactionStatus } from '../types';

// Mock console methods
const originalConsoleError = console.error;
console.error = jest.fn();

describe('NotificationUtils', () => {
  afterAll(() => {
    // Restore console methods
    console.error = originalConsoleError;
  });

  describe('extractUserIdFromEvent', () => {
    it('should extract userId from a generic event with userId field', () => {
      const event = { userId: 'user123', otherData: 'test' };
      expect(extractUserIdFromEvent(event)).toBe('user123');
    });

    it('should extract userId from a generic event with sub field', () => {
      const event = { sub: 'user456', otherData: 'test' };
      expect(extractUserIdFromEvent(event)).toBe('user456');
    });

    it('should extract userId from Fedimint success event', () => {
      const event = {
        operationId: 'operation123',
        context: FedimintContext.SOLOWALLET_RECEIVE,
      };
      expect(extractUserIdFromEvent(event)).toBe('operation123');
    });

    it('should extract userId from Fedimint failure event', () => {
      const event = {
        operationId: 'operation456',
        context: FedimintContext.CHAMAWALLET_RECEIVE,
        error: 'Something went wrong',
      };
      expect(extractUserIdFromEvent(event)).toBe('operation456');
    });

    it('should extract userId from swap event', () => {
      const event = {
        context: SwapContext.ONRAMP,
        payload: {
          swapTracker: 'swap789',
          swapStatus: TransactionStatus.COMPLETE,
          refundable: false,
        },
      };
      expect(extractUserIdFromEvent(event)).toBe('swap789');
    });

    it('should extract userId from wallet transaction event', () => {
      const event = {
        context: WalletTxContext.COLLECTION_FOR_SHARES,
        payload: {
          paymentTracker: 'payment123',
          paymentStatus: TransactionStatus.PENDING,
        },
      };
      expect(extractUserIdFromEvent(event)).toBe('payment123');
    });

    it('should return null for invalid events', () => {
      const event = { someField: 'test' };
      expect(extractUserIdFromEvent(event)).toBeNull();
    });

    it('should throw error when throwOnInvalid is true', () => {
      const event = { someField: 'test' };
      expect(() =>
        extractUserIdFromEvent(event, { throwOnInvalid: true }),
      ).toThrow('Failed to extract valid user ID');
    });

    it('should check custom userIdFields', () => {
      const event = { customId: 'user789', otherData: 'test' };
      expect(
        extractUserIdFromEvent(event, { userIdFields: ['customId'] }),
      ).toBe('user789');
    });

    it('should validate and reject empty user IDs', () => {
      const event = { userId: '' };
      expect(extractUserIdFromEvent(event)).toBeNull();
    });

    it('should validate and reject whitespace-only user IDs', () => {
      const event = { userId: '   ' };
      expect(extractUserIdFromEvent(event)).toBeNull();
    });
  });
});
