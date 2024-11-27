import { Injectable, Logger } from '@nestjs/common';
import { BuySharesDto, ShareDetailResponse } from '@bitsacco/common';
import { SharesRepository } from './db';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(private readonly shares: SharesRepository) {
    this.logger.log('SharesService created');
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

    const allShares = await this.shares.find({ userId });
    const totalShares = allShares.reduce(
      (sum, share) => sum + share.quantity,
      0,
    );
    const shares = allShares
      .map((share) => ({
        quantity: share.quantity,
        purchasedAtUnix: Number(share.createdAt),
      }))
      .reverse();

    const shareSubscription = await this.getShareSubscrition({});

    const res: ShareDetailResponse = {
      userId,
      totalShares,
      shares,
      shareSubscription,
    };

    return Promise.resolve(res);
  }
}
