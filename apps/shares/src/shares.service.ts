import { Injectable, Logger } from '@nestjs/common';
import { BuySharesDto, ShareDetailResponse } from '@bitsacco/common';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor() {
    this.logger.log('SharesService created');
  }

  async buyShares({
    userId,
    quantity,
  }: BuySharesDto): Promise<ShareDetailResponse> {
    this.logger.debug(`Buying ${quantity} Bitsacco shares for ${userId}`);

    const res: ShareDetailResponse = {
      userId,
      totalShares: quantity,
      shares: [
        {
          quantity,
          purchasedAtUnix: new Date().getTime(),
        },
      ],
    };

    return Promise.resolve(res);
  }
}
