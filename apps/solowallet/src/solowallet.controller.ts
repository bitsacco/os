import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  SolowalletServiceControllerMethods,
  DepositFundsRequestDto,
  UserTxsRequestDto,
  WithdrawFundsRequestDto,
  UpdateTxDto,
  ContinueTxRequestDto,
  FindTxRequestDto,
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
  userTransactions(request: UserTxsRequestDto) {
    return this.solowalletService.userTransactions(request);
  }

  @GrpcMethod()
  withdrawFunds(request: WithdrawFundsRequestDto) {
    return this.solowalletService.withdrawFunds(request);
  }

  @GrpcMethod()
  updateTransaction(request: UpdateTxDto) {
    return this.solowalletService.updateTransaction(request);
  }

  @GrpcMethod()
  continueTransaction(request: ContinueTxRequestDto) {
    return this.solowalletService.continueTransaction(request);
  }

  @GrpcMethod()
  findTransaction(request: FindTxRequestDto) {
    return this.solowalletService.findTransaction(request);
  }
}
