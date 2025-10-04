import {
  Body,
  Controller,
  Get,
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
  ApiSecurity,
} from '@nestjs/swagger';
import {
  ContinueDepositFundsRequestDto,
  ContinueWithdrawFundsRequestDto,
  DepositFundsRequestDto,
  JwtAuthGuard,
  UpdateTxDto,
  UserTxsRequestDto,
  WithdrawFundsRequestDto,
  HandleServiceErrors,
  ResourceOwnerGuard,
  CheckOwnership,
} from '../common';
import { SolowalletService } from './solowallet.service';
import { ConfigService } from '@nestjs/config';

@Controller('solowallet')
export class SolowalletController {
  private readonly logger = new Logger(SolowalletController.name);

  constructor(
    private readonly solowalletService: SolowalletService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('SolowalletController initialized');
  }

  @Post('deposit')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({ summary: 'Deposit funds to Solowallet' })
  @ApiBody({
    type: DepositFundsRequestDto,
  })
  @HandleServiceErrors()
  async depositFunds(@Body() req: DepositFundsRequestDto) {
    return await this.solowalletService.depositFunds(req);
  }

  @Post('deposit/continue')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({ summary: 'Continue Solowallet deposit transaction' })
  @ApiBody({
    type: ContinueDepositFundsRequestDto,
  })
  @HandleServiceErrors()
  async continueDepositTransaction(
    @Body() req: ContinueDepositFundsRequestDto,
  ) {
    return await this.solowalletService.continueDepositFunds(req);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({ summary: 'Withdraw funds from Solowallet' })
  @ApiBody({
    type: WithdrawFundsRequestDto,
  })
  @HandleServiceErrors()
  async withdrawFunds(@Body() req: WithdrawFundsRequestDto) {
    return await this.solowalletService.withdrawFunds(req);
  }

  @Post('withdraw/continue')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({ summary: 'Continue Solowallet withdraw transaction' })
  @ApiBody({
    type: ContinueWithdrawFundsRequestDto,
  })
  @HandleServiceErrors()
  async continueWithdrawTransaction(
    @Body() req: ContinueWithdrawFundsRequestDto,
  ) {
    return await this.solowalletService.continueWithdrawFunds(req);
  }

  @Post('transactions')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({ summary: 'Find Solowallet user transactions' })
  @ApiBody({
    type: UserTxsRequestDto,
  })
  @HandleServiceErrors()
  async userTransactions(@Body() req: UserTxsRequestDto) {
    return await this.solowalletService.userTransactions(req);
  }

  @Post('update')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update Solowallet transaction (admin only)' })
  @ApiBody({
    type: UpdateTxDto,
  })
  @HandleServiceErrors()
  async updateTransaction(@Body() req: UpdateTxDto) {
    return await this.solowalletService.updateTransaction(req);
  }

  @Get('/find/id/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({ summary: 'Get transaction by ID (with ownership check)' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @HandleServiceErrors()
  async findTransaction(@Param('id') id: string) {
    return await this.solowalletService.findTransaction({ txId: id });
  }
}
