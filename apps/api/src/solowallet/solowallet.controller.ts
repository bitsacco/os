import {
  DepositFundsRequestDto,
  UpdateTxDto,
  UserTxsRequestDto,
  WithdrawFundsRequestDto,
} from '@bitsacco/common';
import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiBody } from '@nestjs/swagger';
import { SolowalletService } from './solowallet.service';

@Controller('solowallet')
export class SolowalletController {
  private readonly logger = new Logger(SolowalletController.name);

  constructor(private readonly walletService: SolowalletService) {
    this.logger.log('SolowalletController initialized');
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Deposit funds to Solowallet' })
  @ApiBody({
    type: DepositFundsRequestDto,
  })
  depositFunds(@Body() req: DepositFundsRequestDto) {
    return this.walletService.depositFunds(req);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw funds from Solowallet' })
  @ApiBody({
    type: WithdrawFundsRequestDto,
  })
  withdrawFunds(@Body() req: WithdrawFundsRequestDto) {
    return this.walletService.withdrawFunds(req);
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Find Solowallet user transactions' })
  @ApiBody({
    type: UserTxsRequestDto,
  })
  userTransactions(@Body() req: UserTxsRequestDto) {
    return this.walletService.userTransactions(req);
  }

  @Post('update')
  @ApiOperation({ summary: 'Update Solowallet transaction' })
  @ApiBody({
    type: UpdateTxDto,
  })
  updateShares(@Body() req: UpdateTxDto) {
    return this.walletService.updateTransaction(req);
  }
}
