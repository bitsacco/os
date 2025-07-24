import { performance } from 'perf_hooks';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  AllSharesOffers,
  AllSharesTxsResponse,
  collection_for_shares,
  default_page,
  default_page_size,
  FindSharesTxDto,
  OfferSharesDto,
  PaginatedRequestDto,
  PaginatedUserSharesTxsResponse,
  SharesOffer,
  SharesTx,
  SharesTxStatus,
  SubscribeSharesDto,
  TransactionStatus,
  TransferSharesDto,
  UpdateSharesDto,
  UserSharesDto,
  UserShareTxsResponse,
  type WalletTxEvent,
} from '@bitsacco/common';
import { SharesOfferRepository, SharesRepository, toSharesTx } from './db';
import { SharesMetricsService } from './shares.metrics';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    private readonly shareOffers: SharesOfferRepository,
    private readonly shares: SharesRepository,
    private readonly metrics: SharesMetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('SharesService created');

    this.eventEmitter.on(
      collection_for_shares,
      this.handleWalletTxForShares.bind(this),
    );
  }

  async offerShares({
    quantity,
    availableFrom,
    availableTo,
  }: OfferSharesDto): Promise<AllSharesOffers> {
    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Share offer quantity must be greater than zero');
    }

    await this.shareOffers.create({
      quantity,
      subscribedQuantity: 0,
      availableFrom: new Date(availableFrom),
      availableTo: availableTo ? new Date(availableTo) : undefined,
    });

    return this.getSharesOffers();
  }

  async getSharesOffers(): Promise<AllSharesOffers> {
    const offers: SharesOffer[] = (
      await this.shareOffers.find({}, { createdAt: -1 })
    ).map((offer) => ({
      id: offer._id,
      quantity: offer.quantity,
      subscribedQuantity: offer.subscribedQuantity,
      availableFrom: offer.availableFrom.toDateString(),
      availableTo: offer.availableTo.toDateString(),
      createdAt: offer.createdAt.toDateString(),
      updatedAt: offer.updatedAt.toDateString(),
    }));

    const totalOfferQuantity = offers.reduce(
      (sum, offer) => sum + offer.quantity,
      0,
    );
    const totalSubscribedQuantity = offers.reduce(
      (sum, offer) => sum + offer.subscribedQuantity,
      0,
    );

    const res: AllSharesOffers = {
      offers,
      totalOfferQuantity,
      totalSubscribedQuantity,
    };

    return Promise.resolve(res);
  }

  async subscribeShares({
    userId,
    offerId,
    quantity,
  }: SubscribeSharesDto): Promise<UserShareTxsResponse> {
    this.logger.debug(`Subscribing ${quantity} Bitsacco shares for ${userId}`);

    // Start performance measurement
    const startTime = performance.now();
    let success = false;
    let errorType = '';

    try {
      // Check if the offer exists and has enough available shares
      const offer = await this.shareOffers.findOne({ _id: offerId });

      if (!offer) {
        errorType = 'OFFER_NOT_FOUND';
        throw new Error(`Share offer with ID ${offerId} not found`);
      }

      const availableShares = offer.quantity - offer.subscribedQuantity;

      if (availableShares < quantity) {
        errorType = 'INSUFFICIENT_SHARES';
        throw new Error(
          `Not enough shares available for subscription. Requested: ${quantity}, Available: ${availableShares}`,
        );
      }

      // Get all share offers to calculate the total shares available
      const allOffers = await this.getSharesOffers();
      const totalSharesAvailable = allOffers.totalOfferQuantity;

      // Calculate the maximum allowed shares per user (20% of total)
      const maxSharesPerUser = Math.floor(totalSharesAvailable * 0.2);

      // Get user's current share holdings
      const userShares = await this.userSharesTransactions({
        userId,
        pagination: { page: default_page, size: default_page_size },
      });

      // Calculate total holdings after this subscription
      const currentHoldings = userShares.shareHoldings;
      const totalAfterSubscription = currentHoldings + quantity;

      // Record ownership metrics
      const percentageOfTotal =
        (totalAfterSubscription / totalSharesAvailable) * 100;
      this.metrics.recordOwnershipMetric({
        userId,
        quantity: currentHoldings,
        percentageOfTotal,
        limitReached: percentageOfTotal >= 15, // Warn at 15% approaching the 20% limit
      });

      // Check if this subscription would exceed the 20% limit
      if (totalAfterSubscription > maxSharesPerUser) {
        errorType = 'OWNERSHIP_LIMIT_EXCEEDED';
        throw new Error(
          `Subscription exceeds maximum allowed shares per user (20% of total). ` +
            `Current: ${currentHoldings}, Requested: ${quantity}, ` +
            `Maximum Allowed: ${maxSharesPerUser}, Total After: ${totalAfterSubscription}`,
        );
      }

      await this.shares.create({
        userId,
        offerId,
        quantity,
        status: SharesTxStatus.PROPOSED,
      });

      // Operation was successful
      success = true;

      const result = await this.userSharesTransactions({
        userId,
        pagination: { page: default_page, size: default_page_size },
      });

      return result;
    } catch (error) {
      this.logger.error(`Error subscribing shares: ${error.message}`);
      errorType = errorType || 'UNKNOWN_ERROR';
      throw error;
    } finally {
      // Record metrics regardless of success or failure
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      this.metrics.recordSubscriptionMetric({
        userId,
        offerId,
        quantity,
        success,
        duration,
        errorType: success ? undefined : errorType,
      });
    }
  }

  async transferShares({
    sharesId,
    ...transfer
  }: TransferSharesDto): Promise<UserShareTxsResponse> {
    // Start performance measurement
    const startTime = performance.now();
    let success = false;
    let errorType = '';

    try {
      const originShares = await this.shares.findOne({ _id: sharesId });

      if (originShares.status !== SharesTxStatus.COMPLETE) {
        errorType = 'SHARES_NOT_AVAILABLE';
        throw new Error('Shares are not available to transfer');
      }

      if (originShares.quantity < transfer.quantity) {
        errorType = 'INSUFFICIENT_SHARES';
        throw new Error('Not enough shares to transfer');
      }

      // Get all share offers to calculate the total shares available
      const allOffers = await this.getSharesOffers();
      const totalSharesAvailable = allOffers.totalOfferQuantity;

      // Calculate the maximum allowed shares per user (20% of total)
      const maxSharesPerUser = Math.floor(totalSharesAvailable * 0.2);

      // Get recipient's current share holdings
      const recipientShares = await this.userSharesTransactions({
        userId: transfer.toUserId,
        pagination: { page: default_page, size: default_page_size },
      });

      // Calculate total holdings after this transfer
      const currentHoldings = recipientShares.shareHoldings;
      const totalAfterTransfer = currentHoldings + transfer.quantity;

      // Record ownership metrics for recipient
      const percentageOfTotal =
        (totalAfterTransfer / totalSharesAvailable) * 100;
      this.metrics.recordOwnershipMetric({
        userId: transfer.toUserId,
        quantity: currentHoldings,
        percentageOfTotal,
        limitReached: percentageOfTotal >= 15, // Warn at 15% approaching the 20% limit
      });

      // Check if this transfer would exceed the 20% limit for the recipient
      if (totalAfterTransfer > maxSharesPerUser) {
        errorType = 'OWNERSHIP_LIMIT_EXCEEDED';
        throw new Error(
          `Transfer exceeds maximum allowed shares per user (20% of total). ` +
            `Recipient Current: ${currentHoldings}, Transfer Amount: ${transfer.quantity}, ` +
            `Maximum Allowed: ${maxSharesPerUser}, Total After: ${totalAfterTransfer}`,
        );
      }

      // Update origin shares quantity, and record transfer metadata
      await this.updateShares({
        sharesId,
        updates: {
          quantity: originShares.quantity - transfer.quantity,
          transfer,
        },
      });

      // Assign shares to the recipient
      await this.shares.create({
        userId: transfer.toUserId,
        offerId: originShares.offerId,
        quantity: transfer.quantity,
        status: SharesTxStatus.COMPLETE,
        transfer,
      });

      // Operation was successful
      success = true;

      const result = await this.userSharesTransactions({
        userId: transfer.fromUserId,
        pagination: { page: default_page, size: default_page_size },
      });

      return result;
    } catch (error) {
      this.logger.error(`Error transferring shares: ${error.message}`);
      errorType = errorType || 'UNKNOWN_ERROR';
      throw error;
    } finally {
      // Record metrics regardless of success or failure
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      this.metrics.recordTransferMetric({
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        quantity: transfer.quantity,
        success,
        duration,
        errorType: success ? undefined : errorType,
      });
    }
  }

  async updateShares({
    sharesId,
    updates,
  }: UpdateSharesDto): Promise<UserShareTxsResponse> {
    const originShares = await this.shares.findOne({ _id: sharesId });
    const { quantity, status, transfer, offerId } = updates;

    this.logger.log(`Updates : ${JSON.stringify(updates)}`);

    const { userId } = await this.shares.findOneAndUpdate(
      { _id: sharesId },
      {
        quantity: quantity !== undefined ? quantity : originShares.quantity,
        status: status !== undefined ? status : originShares.status,
        transfer: transfer ?? originShares.transfer,
        offerId: offerId ?? originShares.offerId,
      },
    );

    if (
      status === SharesTxStatus.COMPLETE ||
      status === SharesTxStatus.APPROVED
    ) {
      // Update the subscribed quantity for the offer
      try {
        const offer = await this.shareOffers.findOne({
          _id: originShares.offerId,
        });

        if (offer) {
          const newQuantity = offer.subscribedQuantity + originShares.quantity;
          await this.shareOffers.findOneAndUpdate(
            { _id: originShares.offerId },
            {
              subscribedQuantity: newQuantity,
            },
          );
          this.logger.log(
            `Updated offer ${originShares.offerId} subscribed quantity to ${newQuantity}`,
          );
        } else {
          this.logger.warn(
            `Offer with ID ${originShares.offerId} not found for updating subscribed quantity`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error updating offer subscribed quantity: ${error.message}`,
        );
      }
    }

    return this.userSharesTransactions({
      userId,
      pagination: { page: default_page, size: default_page_size },
    });
  }

  async userSharesTransactions({
    userId,
    pagination,
  }: UserSharesDto): Promise<UserShareTxsResponse> {
    const shares = (
      await this.shares.find({ userId, ...STATUS_FILTER }, { createdAt: -1 })
    ).map(toSharesTx, pagination);

    const shareHoldings = shares
      .filter((share) => {
        return (
          share.status === SharesTxStatus.COMPLETE ||
          share.status === SharesTxStatus.APPROVED
        );
      })
      .reduce((sum, share) => sum + share.quantity, 0);

    const txShares = await this.getPaginatedShareTx({ userId }, pagination);

    const offers = await this.getSharesOffers();

    return {
      userId,
      shareHoldings,
      shares: txShares,
      offers,
    };
  }

  async allSharesTransactions(): Promise<AllSharesTxsResponse> {
    const shares = await this.getPaginatedShareTx(null, {
      page: default_page,
      size: default_page_size,
    });

    const offers = await this.getSharesOffers();

    return {
      shares,
      offers,
    };
  }

  async findSharesTransaction({
    sharesId,
  }: FindSharesTxDto): Promise<SharesTx> {
    const shares = toSharesTx(await this.shares.findOne({ _id: sharesId }));

    if (!shares) {
      throw new Error('Shares transaction not found');
    }

    return shares;
  }

  private async getPaginatedShareTx(
    query: { userId: string } | null,
    pagination: PaginatedRequestDto,
  ): Promise<PaginatedUserSharesTxsResponse> {
    const allShareTx = await this.shares.find(
      { ...(query || {}), ...STATUS_FILTER },
      { createdAt: -1 },
    );

    const { page, size } = pagination;
    const pages = Math.ceil(allShareTx.length / size);

    const selectPage = page > pages ? pages - 1 : page;

    const transactions = allShareTx
      .slice(selectPage * size, (selectPage + 1) * size)
      .map((tx) => {
        let status = SharesTxStatus.UNRECOGNIZED;
        try {
          status = Number(tx.status) as SharesTxStatus;
        } catch (error) {
          this.logger.warn('Error parsing transaction type', error);
        }

        return {
          ...tx,
          id: tx._id,
          userId: tx.userId,
          offerId: tx.offerId,
          quantity: tx.quantity,
          status,
          createdAt: tx.createdAt.toDateString(),
          updatedAt: tx.updatedAt.toDateString(),
        };
      });

    return {
      transactions,
      page: selectPage,
      size,
      pages,
    };
  }

  @OnEvent(collection_for_shares)
  private async handleWalletTxForShares({
    context,
    payload,
    error,
  }: WalletTxEvent) {
    const { paymentTracker, paymentStatus } = payload;
    this.logger.log(
      `Received swap status change - context: ${context} - sharesTransactionTracker : ${paymentTracker} - status : ${paymentStatus}`,
    );

    // Start performance measurement
    const startTime = performance.now();
    let success = false;
    let errorType = '';
    let sharesStatus: SharesTxStatus = SharesTxStatus.UNRECOGNIZED;
    let userId = '';
    let offerId = '';
    let quantity = 0;

    if (error) {
      this.logger.error(
        `Wallet Tx ${paymentTracker} shares failed with error : ${error}`,
      );
      errorType = 'WALLET_TX_ERROR';
    }

    try {
      // Find the shares transaction using the payment tracker (shares transaction ID)
      const sharesTx = await this.shares.findOne({ _id: paymentTracker });

      if (!sharesTx) {
        this.logger.warn(
          `No shares transaction found with ID ${paymentTracker}`,
        );
        errorType = 'SHARES_TX_NOT_FOUND';
        return;
      }

      // Store transaction details for metrics
      userId = sharesTx.userId;
      offerId = sharesTx.offerId;
      quantity = sharesTx.quantity;

      // Update the shares transaction status based on payment status
      switch (paymentStatus) {
        case TransactionStatus.COMPLETE:
          sharesStatus = SharesTxStatus.COMPLETE;
          break;

        case TransactionStatus.PROCESSING:
          sharesStatus = SharesTxStatus.PROCESSING;
          break;

        case TransactionStatus.FAILED:
        case TransactionStatus.UNRECOGNIZED:
          sharesStatus = SharesTxStatus.FAILED;
          errorType = 'PAYMENT_FAILED';
          break;

        case TransactionStatus.PENDING:
        default:
          sharesStatus = sharesTx.status;
          break;
      }

      // Update the shares transaction status
      await this.updateShares({
        sharesId: paymentTracker,
        updates: {
          status: sharesStatus,
        },
      });

      // If the transaction is now complete or approved, update the offer's subscribed quantity
      if (
        sharesStatus === SharesTxStatus.COMPLETE ||
        sharesStatus === SharesTxStatus.APPROVED
      ) {
        try {
          const offer = await this.shareOffers.findOne({
            _id: sharesTx.offerId,
          });

          if (offer) {
            await this.shareOffers.findOneAndUpdate(
              { _id: sharesTx.offerId },
              {
                subscribedQuantity:
                  offer.subscribedQuantity + sharesTx.quantity,
              },
            );
            this.logger.log(
              `Updated offer ${sharesTx.offerId} subscribed quantity to ${
                offer.subscribedQuantity + sharesTx.quantity
              }`,
            );

            // Operation was successful
            success = true;

            // Record ownership metrics for the user
            const allOffers = await this.getSharesOffers();
            const totalSharesAvailable = allOffers.totalOfferQuantity;

            // Get user's current share holdings after this update
            const userShares = await this.userSharesTransactions({
              userId: sharesTx.userId,
              pagination: { page: default_page, size: default_page_size },
            });

            const currentHoldings = userShares.shareHoldings;
            const percentageOfTotal =
              (currentHoldings / totalSharesAvailable) * 100;

            this.metrics.recordOwnershipMetric({
              userId: sharesTx.userId,
              quantity: currentHoldings,
              percentageOfTotal,
              limitReached: percentageOfTotal >= 15, // Warn at 15% approaching the 20% limit
            });
          } else {
            this.logger.warn(
              `Offer with ID ${sharesTx.offerId} not found for updating subscribed quantity`,
            );
            errorType = 'OFFER_NOT_FOUND';
          }
        } catch (error) {
          this.logger.error(
            `Error updating offer subscribed quantity: ${error.message}`,
          );
          errorType = 'OFFER_UPDATE_ERROR';
        }
      }

      this.logger.log(
        `Updated shares transaction ${paymentTracker} to ${SharesTxStatus[sharesStatus]} status`,
      );
    } catch (err) {
      this.logger.error(
        `Error processing wallet transaction for shares: ${err.message}`,
      );
      errorType = errorType || 'PROCESSING_ERROR';
    } finally {
      // Record metrics regardless of success or failure
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      // Only record metrics if we have a valid transaction
      if (userId && offerId) {
        this.metrics.recordSubscriptionMetric({
          userId,
          offerId,
          quantity,
          success,
          duration,
          errorType: success ? undefined : errorType,
        });

        this.logger.log(
          `Recorded wallet transaction metrics for shares - UserId: ${userId}, ` +
            `OfferId: ${offerId}, Quantity: ${quantity}, Status: ${SharesTxStatus[sharesStatus]}, ` +
            `Success: ${success}, Duration: ${duration}ms${errorType ? `, Error: ${errorType}` : ''}`,
        );
      }
    }
  }
}

const STATUS_FILTER = {
  status: { $ne: SharesTxStatus.UNRECOGNIZED },
};
