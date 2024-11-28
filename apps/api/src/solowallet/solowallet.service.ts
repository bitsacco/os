import {
  DepositFundsRequestDto,
  SOLOWALLET_SERVICE_NAME,
  SolowalletServiceClient,
} from '@bitsacco/common';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Injectable()
export class SolowalletService implements OnModuleInit {
  private client: SolowalletServiceClient;

  constructor(
    @Inject(SOLOWALLET_SERVICE_NAME) private readonly grpc: ClientGrpc,
  ) {}

  onModuleInit() {
    this.client = this.grpc.getService<SolowalletServiceClient>(
      SOLOWALLET_SERVICE_NAME,
    );
  }

  depositFunds(req: DepositFundsRequestDto) {
    return this.client.depositFunds(req);
  }
}
