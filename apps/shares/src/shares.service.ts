import { Injectable, Logger } from '@nestjs/common';
import {
  AllSharesOffers,
  AllSharesTxsResponse,
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
  TransferSharesDto,
  UpdateSharesDto,
  UserSharesDto,
  UserShareTxsResponse,
} from '@bitsacco/common';
import { SharesOfferRepository, SharesRepository, toSharesTx } from './db';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    private readonly shareOffers: SharesOfferRepository,
    private readonly shares: SharesRepository,
  ) {
    this.logger.log('SharesService created');
  }

  async offerShares({
    quantity,
    availableFrom,
    availableTo,
  }: OfferSharesDto): Promise<AllSharesOffers> {
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

    await this.shares.create({
      userId,
      offerId,
      quantity,
      status: SharesTxStatus.PROPOSED,
    });

    return this.userSharesTransactions({
      userId,
      pagination: { page: default_page, size: default_page_size },
    });
  }

  async transferShares({
    sharesId,
    ...transfer
  }: TransferSharesDto): Promise<UserShareTxsResponse> {
    const originShares = await this.shares.findOne({ _id: sharesId });

    if (originShares.status !== SharesTxStatus.COMPLETE) {
      throw new Error('Shares are not available to transfer');
    }

    if (originShares.quantity < transfer.quantity) {
      throw new Error('Not enough shares to transfer');
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

    return this.userSharesTransactions({
      userId: transfer.fromUserId,
      pagination: { page: default_page, size: default_page_size },
    });
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

    this.logger.log(`Shares: ${JSON.stringify(shares)}`);

    const shareHoldings = shares
      .filter((share) => {
        return (
          share.status === SharesTxStatus.COMPLETE ||
          share.status === SharesTxStatus.APPROVED
        );
      })
      .reduce((sum, share) => sum + share.quantity, 0);

    const txShares = await this.getPaginatedShareTx({ userId }, pagination);

    this.logger.log(`Tx shares: ${JSON.stringify(txShares)}`);

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

    this.logger.log(`shares: ${JSON.stringify(shares)}`);

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
}

const STATUS_FILTER = {
  status: { $ne: SharesTxStatus.UNRECOGNIZED },
};
