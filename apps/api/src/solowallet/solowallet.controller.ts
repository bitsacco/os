import {
  ContinueTxRequestDto,
  DepositFundsRequestDto,
  JwtAuthGuard,
  SOLOWALLET_SERVICE_NAME,
  SolowalletServiceClient,
  UpdateTxDto,
  UserTxsRequestDto,
  WithdrawFundsRequestDto,
} from '@bitsacco/common';
import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { type ClientGrpc } from '@nestjs/microservices';

@Controller('solowallet')
@UseGuards(JwtAuthGuard)
export class SolowalletController {
  private walletService: SolowalletServiceClient;
  private readonly logger = new Logger(SolowalletController.name);

  constructor(
    @Inject(SOLOWALLET_SERVICE_NAME)
    private readonly grpc: ClientGrpc,
  ) {
    this.walletService = this.grpc.getService<SolowalletServiceClient>(
      SOLOWALLET_SERVICE_NAME,
    );
    this.logger.log('SolowalletController initialized');
  }

  @Post('deposit')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Deposit funds to Solowallet' })
  @ApiBody({
    type: DepositFundsRequestDto,
  })
  depositFunds(@Body() req: DepositFundsRequestDto) {
    return this.walletService.depositFunds(req);
  }

  @Post('withdraw')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Withdraw funds from Solowallet' })
  @ApiBody({
    type: WithdrawFundsRequestDto,
  })
  withdrawFunds(@Body() req: WithdrawFundsRequestDto) {
    return this.walletService.withdrawFunds(req);
  }

  @Post('transactions')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find Solowallet user transactions' })
  @ApiBody({
    type: UserTxsRequestDto,
  })
  userTransactions(@Body() req: UserTxsRequestDto) {
    return this.walletService.userTransactions(req);
  }

  @Post('update')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update Solowallet transaction' })
  @ApiBody({
    type: UpdateTxDto,
  })
  updateShares(@Body() req: UpdateTxDto) {
    return this.walletService.updateTransaction(req);
  }

  @Post('continue')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Continue Solowallet transaction' })
  @ApiBody({
    type: ContinueTxRequestDto,
  })
  continueTransaction(@Body() req: ContinueTxRequestDto) {
    return this.walletService.continueTransaction(req);
  }

  @Get('/find/id/:id')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async findTransaction(@Param('id') id: string) {
    return this.walletService.findTransaction({ txId: id });
  }
}
