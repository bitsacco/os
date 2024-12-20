import {
  SharesServiceClient,
  SHARES_SERVICE_NAME,
  BuySharesDto,
  Empty,
  GetShareDetailDto,
} from '@bitsacco/common';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Injectable()
export class SharesService implements OnModuleInit {
  private client: SharesServiceClient;

  constructor(@Inject(SHARES_SERVICE_NAME) private readonly grpc: ClientGrpc) {}

  onModuleInit() {
    this.client =
      this.grpc.getService<SharesServiceClient>(SHARES_SERVICE_NAME);
  }

  getShareDetail(req: GetShareDetailDto) {
    return this.client.getShareDetail(req);
  }

  buyShares(req: BuySharesDto) {
    return this.client.buyShares(req);
  }

  getShareSubscription(req: Empty) {
    return this.client.getShareSubscription({});
  }
}
