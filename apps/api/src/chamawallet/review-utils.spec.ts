import { Logger } from '@nestjs/common';
import { ChamaMemberRole, ChamaTxStatus, Review } from '@bitsacco/common';
import {
  calculateTransactionStatus,
  hasReviewFromMember,
  addOrUpdateReview,
  ReviewableTransaction,
  ChamaWithMembers,
} from './review-utils';

describe('Review Utilities', () => {
  let mockLogger: Logger;
  let mockTransaction: ReviewableTransaction;
  let mockChama: ChamaWithMembers;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    // Reset transaction with empty reviews
    mockTransaction = {
      _id: 'tx-123',
      reviews: [],
    };

    // Define a test chama with 3 admin members
    mockChama = {
      members: [
        { userId: 'admin-1', roles: [ChamaMemberRole.Admin] },
        { userId: 'admin-2', roles: [ChamaMemberRole.Admin] },
        { userId: 'admin-3', roles: [ChamaMemberRole.ExternalAdmin] },
        { userId: 'member-1', roles: [ChamaMemberRole.Member] },
        { userId: 'member-2', roles: [ChamaMemberRole.Member] },
      ],
    };
  });

  describe('calculateTransactionStatus', () => {
    it('should return REJECTED if any review is a rejection', () => {
      // Add two approvals and one rejection
      mockTransaction.reviews = [
        { memberId: 'admin-1', review: Review.APPROVE },
        { memberId: 'admin-2', review: Review.APPROVE },
        { memberId: 'admin-3', review: Review.REJECT },
      ];

      const status = calculateTransactionStatus(
        mockTransaction,
        mockChama,
        ChamaTxStatus.PENDING,
        mockLogger,
      );
      expect(status).toBe(ChamaTxStatus.REJECTED);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Transaction tx-123 has been rejected by at least one admin',
      );
    });

    it('should return APPROVED if all admins have approved', () => {
      // Add approvals from all admins
      mockTransaction.reviews = [
        { memberId: 'admin-1', review: Review.APPROVE },
        { memberId: 'admin-2', review: Review.APPROVE },
        { memberId: 'admin-3', review: Review.APPROVE },
      ];

      const status = calculateTransactionStatus(
        mockTransaction,
        mockChama,
        ChamaTxStatus.PENDING,
        mockLogger,
      );
      expect(status).toBe(ChamaTxStatus.APPROVED);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Transaction tx-123 has been approved by all required admins (3/3)',
      );
    });

    it('should return PENDING if not all admins have approved yet', () => {
      // Add approvals from only 2 of 3 admins
      mockTransaction.reviews = [
        { memberId: 'admin-1', review: Review.APPROVE },
        { memberId: 'admin-2', review: Review.APPROVE },
      ];

      const status = calculateTransactionStatus(
        mockTransaction,
        mockChama,
        ChamaTxStatus.PENDING,
        mockLogger,
      );
      expect(status).toBe(ChamaTxStatus.PENDING);
    });

    it('should handle empty reviews array', () => {
      // No reviews yet
      mockTransaction.reviews = [];

      const status = calculateTransactionStatus(
        mockTransaction,
        mockChama,
        ChamaTxStatus.PENDING,
        mockLogger,
      );
      expect(status).toBe(ChamaTxStatus.PENDING);
    });
  });

  describe('hasReviewFromMember', () => {
    it('should return true if member has reviewed', () => {
      mockTransaction.reviews = [
        { memberId: 'admin-1', review: Review.APPROVE },
        { memberId: 'admin-2', review: Review.REJECT },
      ];

      expect(hasReviewFromMember(mockTransaction, 'admin-1')).toBe(true);
      expect(hasReviewFromMember(mockTransaction, 'admin-2')).toBe(true);
      expect(hasReviewFromMember(mockTransaction, 'admin-3')).toBe(false);
    });

    it('should check for specific review type if provided', () => {
      mockTransaction.reviews = [
        { memberId: 'admin-1', review: Review.APPROVE },
        { memberId: 'admin-2', review: Review.REJECT },
      ];

      expect(
        hasReviewFromMember(mockTransaction, 'admin-1', Review.APPROVE),
      ).toBe(true);
      expect(
        hasReviewFromMember(mockTransaction, 'admin-1', Review.REJECT),
      ).toBe(false);
      expect(
        hasReviewFromMember(mockTransaction, 'admin-2', Review.REJECT),
      ).toBe(true);
    });
  });

  describe('addOrUpdateReview', () => {
    it('should add a new review if member has not reviewed yet', () => {
      mockTransaction.reviews = [
        { memberId: 'admin-1', review: Review.APPROVE },
      ];

      const updatedReviews = addOrUpdateReview(
        mockTransaction,
        'admin-2',
        Review.APPROVE,
      );

      expect(updatedReviews).toHaveLength(2);
      expect(updatedReviews).toContainEqual({
        memberId: 'admin-1',
        review: Review.APPROVE,
      });
      expect(updatedReviews).toContainEqual({
        memberId: 'admin-2',
        review: Review.APPROVE,
      });
    });

    it('should update existing review if member has already reviewed', () => {
      mockTransaction.reviews = [
        { memberId: 'admin-1', review: Review.APPROVE },
        { memberId: 'admin-2', review: Review.APPROVE },
      ];

      // Change admin-2's review to REJECT
      const updatedReviews = addOrUpdateReview(
        mockTransaction,
        'admin-2',
        Review.REJECT,
      );

      expect(updatedReviews).toHaveLength(2);
      expect(updatedReviews).toContainEqual({
        memberId: 'admin-1',
        review: Review.APPROVE,
      });
      expect(updatedReviews).toContainEqual({
        memberId: 'admin-2',
        review: Review.REJECT,
      });
    });
  });
});
