import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import {
  DepositFundsRequestDto,
  SolowalletDepositTransaction,
  TransactionStatus,
} from '@bitsacco/common';
import { SolowalletRepository } from './db';

@Injectable()
export class SolowalletService {
  private readonly logger = new Logger(SolowalletService.name);

  constructor(
    private readonly wallet: SolowalletRepository,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('SharesService created');
  }

  async depositFunds({
    userId,
    fiat_deposit,
  }: DepositFundsRequestDto): Promise<SolowalletDepositTransaction> {
    if (fiat_deposit) {
      // initiate onramp swap
    }

    const deposit = await this.wallet.create({
      userId,
      amountMsats: 21,
      status: TransactionStatus.PENDING,
      reference: '123456789',
    });

    return {
      ...deposit,
      id: deposit._id,
      createdAt: deposit.createdAt.toDateString(),
      updatedAt: deposit.updatedAt.toDateString(),
    };
  }
}
