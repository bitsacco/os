import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { BuySharesDto, SharesServiceControllerMethods } from '@bitsacco/common';
import { SharesService } from './shares.service';

@Controller()
@SharesServiceControllerMethods()
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @GrpcMethod()
  buyShares(request: BuySharesDto) {
    return this.sharesService.buyShares(request);
  }
}
