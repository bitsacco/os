import { Injectable, Logger } from '@nestjs/common';
import {
  BuySharesDto,
  Empty,
  GetShareDetailDto,
  ShareDetailResponse,
  ShareSubscriptionResponse,
} from '@bitsacco/common';
import { SharesRepository } from './db';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    private readonly shares: SharesRepository,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('SharesService created');
  }

  async getShareDetail({
    userId,
  }: GetShareDetailDto): Promise<ShareDetailResponse> {
    const allShares = await this.shares.find({ userId }, { createdAt: -1 });
    const shareHoldings = allShares.reduce(
      (sum, share) => sum + share.quantity,
      0,
    );
    const shares = allShares.map((share) => ({
      quantity: share.quantity,
      createdAt: share.createdAt.toDateString(),
      updatedAt: share.updatedAt.toDateString(),
    }));

    const shareSubscription = await this.getShareSubscrition({});

    const res: ShareDetailResponse = {
      userId,
      shareHoldings,
      shares,
      shareSubscription,
    };

    return Promise.resolve(res);
  }

  async buyShares({
    userId,
    quantity,
  }: BuySharesDto): Promise<ShareDetailResponse> {
    this.logger.debug(`Buying ${quantity} Bitsacco shares for ${userId}`);

    await this.shares.create({
      userId,
      quantity,
    });

    return this.getShareDetail({ userId });
  }

  async getShareSubscrition(_: Empty): Promise<ShareSubscriptionResponse> {
    let sharesIssued = this.configService.get<number>('SHARES_ISSUED') || 0;
    let sharesSold = 0;

    try {
      sharesSold = await this.shares
        .aggregate([
          {
            $group: {
              _id: null,
              totalShares: { $sum: { $sum: '$quantity' } },
            },
          },
        ])
        .then((result) => result[0]?.totalShares || 0);
    } catch (e) {
      this.logger.log('Failed to aggregate shares sold');
      sharesSold = sharesIssued;
    }

    return {
      sharesIssued,
      sharesSold,
    };
  }
}
