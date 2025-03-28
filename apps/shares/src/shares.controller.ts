import { Controller, Logger } from '@nestjs/common';
import { EventPattern, GrpcMethod } from '@nestjs/microservices';
import {
  collection_for_shares,
  type Empty,
  type WalletTxEvent,
  FindSharesTxDto,
  OfferSharesDto,
  SharesServiceControllerMethods,
  SubscribeSharesDto,
  TransferSharesDto,
  UpdateSharesDto,
  UserSharesDto,
  WalletTxContext,
} from '@bitsacco/common';
import { SharesService } from './shares.service';

@Controller()
@SharesServiceControllerMethods()
export class SharesController {
  private readonly logger = new Logger(SharesController.name);

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

  @EventPattern(collection_for_shares)
  async handleCollectionForShares(event: WalletTxEvent) {
    this.logger.log(
      `Received a collection_for_shares event with Context : ${event.context} and Payload : ${JSON.stringify(event.payload)}`,
    );
    if (event.context === WalletTxContext.COLLECTION_FOR_SHARES) {
      await this.sharesService.handleWalletTxForShares(event);
    }
  }
}
