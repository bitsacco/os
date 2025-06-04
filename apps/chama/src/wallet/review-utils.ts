import { Logger } from '@nestjs/common';
import {
  ChamaMemberRole,
  ChamaTxReview,
  ChamaTxStatus,
  Review,
} from '@bitsacco/common';

export interface ReviewableTransaction {
  _id?: string;
  reviews: ChamaTxReview[];
}

export interface ChamaWithMembers {
  members: {
    userId: string;
    roles: ChamaMemberRole[];
  }[];
}

/**
 * Calculate transaction status based on reviews
 * @param transaction The transaction with reviews
 * @param chama The chama containing admin information
 * @param logger Optional logger instance
 * @returns The calculated status based on reviews
 */
export function calculateTransactionStatus(
  transaction: ReviewableTransaction,
  chama: ChamaWithMembers,
  defaultStatus: ChamaTxStatus,
  logger?: Logger,
): ChamaTxStatus {
  const reviews = transaction.reviews || [];

  // Check if there are any rejections in the reviews
  const hasRejection = reviews.some(
    (review) => review.review === Review.REJECT,
  );

  if (hasRejection) {
    // If any rejection is found, update status to REJECTED
    if (logger) {
      logger.log(
        `Transaction ${transaction._id || 'unknown'} has been rejected by at least one admin`,
      );
    }
    return ChamaTxStatus.REJECTED;
  }

  // Count admin members in the chama
  const adminCount = chama.members.filter(
    (member) =>
      member.roles.includes(ChamaMemberRole.Admin) ||
      member.roles.includes(ChamaMemberRole.ExternalAdmin),
  ).length;

  // Count approval reviews
  const approvalCount = reviews.filter(
    (review) => review.review === Review.APPROVE,
  ).length;

  // If all admins have approved (approval count meets or exceeds admin count)
  if (approvalCount >= adminCount && adminCount > 0) {
    if (logger) {
      logger.log(
        `Transaction ${transaction._id || 'unknown'} has been approved by all required admins (${approvalCount}/${adminCount})`,
      );
    }
    return ChamaTxStatus.APPROVED;
  }

  // If no decision can be made yet, maintain PENDING status
  return defaultStatus;
}

/**
 * Check if a transaction has a specific review from a member
 * @param transaction The transaction to check
 * @param memberId The member ID to check for
 * @param reviewType Optional review type to check for
 * @returns true if the member has reviewed (with specified type if provided)
 */
export function hasReviewFromMember(
  transaction: ReviewableTransaction,
  memberId: string,
  reviewType?: Review,
): boolean {
  const reviews = transaction.reviews || [];

  return reviews.some(
    (review) =>
      review.memberId === memberId &&
      (reviewType === undefined || review.review === reviewType),
  );
}

/**
 * Add or update a review to a transaction if the member hasn't already reviewed
 * @param transaction The transaction to add the review to
 * @param memberId The member ID providing the review
 * @param reviewType The type of review (APPROVE/REJECT)
 * @returns A new array of reviews with the added review
 */
export function addOrUpdateReview(
  transaction: ReviewableTransaction,
  memberId: string,
  reviewType: Review,
): ChamaTxReview[] {
  const reviews = [...(transaction.reviews || [])];

  // Check if member already has a review
  const existingReviewIndex = reviews.findIndex(
    (review) => review.memberId === memberId,
  );

  if (existingReviewIndex >= 0) {
    // Update existing review
    reviews[existingReviewIndex] = {
      memberId,
      review: reviewType,
    };
  } else {
    // Add new review
    reviews.push({
      memberId,
      review: reviewType,
    });
  }

  return reviews;
}
