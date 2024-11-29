import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  SolowalletServiceControllerMethods,
  DepositFundsRequestDto,
} from '@bitsacco/common';
import { SolowalletService } from './solowallet.service';

@Controller()
@SolowalletServiceControllerMethods()
export class SolowalletController {
  constructor(private readonly solowalletService: SolowalletService) {}

  @GrpcMethod()
  depositFunds(request: DepositFundsRequestDto) {
    return this.solowalletService.depositFunds(request);
  }
}
