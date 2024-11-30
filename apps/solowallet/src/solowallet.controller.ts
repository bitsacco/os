import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  SolowalletServiceControllerMethods,
  DepositFundsRequestDto,
  FindUserTxsRequestDto,
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

  @GrpcMethod()
  findUserDeposits(request: FindUserTxsRequestDto) {
    return this.solowalletService.findUserDeposits(request);
  }
}
