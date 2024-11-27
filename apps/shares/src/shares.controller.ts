import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  BuySharesDto,
  type Empty,
  GetShareDetailDto,
  SharesServiceControllerMethods,
} from '@bitsacco/common';
import { SharesService } from './shares.service';

@Controller()
@SharesServiceControllerMethods()
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @GrpcMethod()
  getShareDetail(request: GetShareDetailDto) {
    return this.sharesService.getShareDetail(request);
  }

  @GrpcMethod()
  buyShares(request: BuySharesDto) {
    return this.sharesService.buyShares(request);
  }

  @GrpcMethod()
  getShareSubscription(request: Empty) {
    return this.sharesService.getShareSubscrition(request);
  }
}
