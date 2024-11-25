import { Injectable, Logger } from '@nestjs/common';
import { BuySharesDto } from '@bitsacco/common';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor() {
    this.logger.log('SharesService created');
  }

  async buyShares({ userId, quantity }: BuySharesDto): Promise<void> {
    this.logger.debug(`Buying ${quantity} Bitsacco shares for ${userId}`);
  }
}
