import { DepositFundsRequestDto } from '@bitsacco/common';
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
}
