import {
  SharesServiceClient,
  SHARES_SERVICE_NAME,
  BuySharesDto,
  Empty,
} from '@bitsacco/common';
import { Inject, Injectable } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Injectable()
export class SharesService {
  private client: SharesServiceClient;

  constructor(@Inject(SHARES_SERVICE_NAME) private readonly grpc: ClientGrpc) {}

  onModuleInit() {
    this.client =
      this.grpc.getService<SharesServiceClient>(SHARES_SERVICE_NAME);
  }

  buyShares(req: BuySharesDto) {
    return this.client.buyShares(req);
  }

  getShareSubscription(req: Empty) {
    return this.client.getShareSubscription({});
  }
}
