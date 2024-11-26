import { Controller, Get } from '@nestjs/common';
import { SolowalletService } from './solowallet.service';
import { GrpcMethod } from '@nestjs/microservices';
import { SolowalletServiceControllerMethods } from '@bitsacco/common';
import { DepositFundsRequestDto } from 'libs/common/src/dto/solowallet.dto';

@Controller()
@SolowalletServiceControllerMethods()
export class SolowalletController {
  constructor(private readonly solowalletService: SolowalletService) {}

  @GrpcMethod()
  depositFunds(request: DepositFundsRequestDto): string {
    return this.solowalletService.depositFunds(request);
  }
}
