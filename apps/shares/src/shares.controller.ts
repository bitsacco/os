import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  type Empty,
  FindSharesTxDto,
  OfferSharesDto,
  SharesServiceControllerMethods,
  SubscribeSharesDto,
  TransferSharesDto,
  UpdateSharesDto,
  UserSharesDto,
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
  updateShares(request: UpdateSharesDto) {
    return this.sharesService.updateShares(request);
  }

  @GrpcMethod()
  userSharesTransactions(request: UserSharesDto) {
    return this.sharesService.userSharesTransactions(request);
  }

  @GrpcMethod()
  allSharesTransactions(_: Empty) {
    return this.sharesService.allSharesTransactions();
  }

  @GrpcMethod()
  findSharesTransaction(request: FindSharesTxDto) {
    return this.sharesService.findSharesTransaction(request);
  }
}
