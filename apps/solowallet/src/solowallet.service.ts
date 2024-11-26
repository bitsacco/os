import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { DepositFundsRequestDto } from '@bitsacco/common';
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

  depositFunds({ userId, fiat_deposit }: DepositFundsRequestDto) {}
}
