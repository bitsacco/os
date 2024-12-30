import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  type Empty,
  OfferSharesDto,
  SharesServiceControllerMethods,
  SubscribeSharesDto,
  TransferSharesDto,
  UserTxsRequestDto,
} from '@bitsacco/common';
import { SharesService } from './shares.service';

@Controller()
@SharesServiceControllerMethods()
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @GrpcMethod()
  offerShares(request: OfferSharesDto) {
    return this.sharesService.offerShares(request);
  }

  @GrpcMethod()
  getSharesOffers(_: Empty) {
    return this.sharesService.getSharesOffers();
  }

  @GrpcMethod()
  subscribeShares(request: SubscribeSharesDto) {
    return this.sharesService.subscribeShares(request);
  }

  @GrpcMethod()
  transferShares(request: TransferSharesDto) {
    return this.sharesService.transferShares(request);
  }

  @GrpcMethod()
  userSharesTransactions(request: UserTxsRequestDto) {
    return this.sharesService.userSharesTransactions(request);
  }

  @GrpcMethod()
  allSharesTransactions(_: Empty) {
    return this.sharesService.allSharesTransactions();
  }
}
