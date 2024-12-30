import {
  SharesServiceClient,
  SHARES_SERVICE_NAME,
  Empty,
  OfferSharesDto,
  SubscribeSharesDto,
  TransferSharesDto,
  UserSharesDto,
  UpdateSharesDto,
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

  offerShares(req: OfferSharesDto) {
    return this.client.offerShares(req);
  }

  getSharesOffers(req: Empty) {
    return this.client.getSharesOffers(req);
  }

  subscribeShares(req: SubscribeSharesDto) {
    return this.client.subscribeShares(req);
  }

  transferShares(req: TransferSharesDto) {
    return this.client.transferShares(req);
  }

  updateShares(req: UpdateSharesDto) {
    return this.client.updateShares(req);
  }

  userSharesTransactions(req: UserSharesDto) {
    return this.client.userSharesTransactions(req);
  }

  allSharesTransactions(req: Empty) {
    return this.client.allSharesTransactions(req);
  }
}
