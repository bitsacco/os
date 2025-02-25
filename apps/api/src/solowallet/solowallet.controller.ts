import {
  ContinueTxRequestDto,
  CurrentUser,
  DepositFundsRequestDto,
  JwtAuthGuard,
  SOLOWALLET_SERVICE_NAME,
  SolowalletServiceClient,
  UpdateTxDto,
  User,
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
  @ApiOperation({ summary: 'Deposit funds to Solowallet' })
  @ApiBody({
    type: DepositFundsRequestDto,
  })
  depositFunds(@CurrentUser() user: User, @Body() req: DepositFundsRequestDto) {
    return this.walletService.depositFunds(req);
  }

  @Post('withdraw')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Withdraw funds from Solowallet' })
  @ApiBody({
    type: WithdrawFundsRequestDto,
  })
  withdrawFunds(
    @CurrentUser() user: User,
    @Body() req: WithdrawFundsRequestDto,
  ) {
    return this.walletService.withdrawFunds(req);
  }

  @Post('transactions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Find Solowallet user transactions' })
  @ApiBody({
    type: UserTxsRequestDto,
  })
  userTransactions(@CurrentUser() user: User, @Body() req: UserTxsRequestDto) {
    return this.walletService.userTransactions(req);
  }

  @Post('update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Solowallet transaction' })
  @ApiBody({
    type: UpdateTxDto,
  })
  updateShares(@Body() req: UpdateTxDto) {
    return this.walletService.updateTransaction(req);
  }

  @Post('continue')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Continue Solowallet transaction' })
  @ApiBody({
    type: ContinueTxRequestDto,
  })
  continueTransaction(@Body() req: ContinueTxRequestDto) {
    return this.walletService.continueTransaction(req);
  }

  @Get('/find/id/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async findTransaction(@Param('id') id: string) {
    return this.walletService.findTransaction({ txId: id });
  }
}
