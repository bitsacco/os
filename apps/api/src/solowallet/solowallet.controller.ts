import {
  ContinueDepositFundsRequestDto,
  ContinueWithdrawFundsRequestDto,
  DepositFundsRequestDto,
  JwtAuthGuard,
  SOLOWALLET_SERVICE_NAME,
  SolowalletServiceClient,
  UpdateTxDto,
  UserTxsRequestDto,
  WithdrawFundsRequestDto,
} from '@bitsacco/common';

// Import for production use - tests will mock these as needed
import { ResourceOwnerGuard, CheckOwnership } from '@bitsacco/common';
import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';
import { type ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('solowallet')
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
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({ summary: 'Deposit funds to Solowallet' })
  @ApiBody({
    type: DepositFundsRequestDto,
  })
  depositFunds(@Body() req: DepositFundsRequestDto) {
    return this.walletService.depositFunds(req);
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
  continueDepositTransaction(@Body() req: ContinueDepositFundsRequestDto) {
    return this.walletService.continueDepositFunds(req);
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
  withdrawFunds(@Body() req: WithdrawFundsRequestDto) {
    return this.walletService.withdrawFunds(req);
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
  continueWithdrawTransaction(@Body() req: ContinueWithdrawFundsRequestDto) {
    return this.walletService.continueWithdrawFunds(req);
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
  userTransactions(@Body() req: UserTxsRequestDto) {
    return this.walletService.userTransactions(req);
  }

  @Post('update')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update Solowallet transaction (admin only)' })
  @ApiBody({
    type: UpdateTxDto,
  })
  updateShares(@Body() req: UpdateTxDto) {
    return this.walletService.updateTransaction(req);
  }

  @Get('/find/id/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({ summary: 'Get transaction by ID (with ownership check)' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async findTransaction(@Param('id') id: string, @Req() req: any) {
    // Check if the request has user data
    if (req.user) {
      // Extract user ID from the user object
      const userRecord = req.user as any;
      const userId = userRecord.id;
      return this.walletService.findTransaction({ txId: id, userId });
    }
    return this.walletService.findTransaction({ txId: id });
  }

  @Get('/lnurl')
  @ApiOperation({ summary: 'Solowallet LNURL callback' })
  @ApiQuery({
    name: 'k1',
    type: String,
    required: true,
    description: 'k1 identifier from bitsacco LNURL (first and second steps)',
  })
  @ApiQuery({
    name: 'tag',
    type: String,
    required: false,
    description:
      'LNURL tag type, must be "withdrawRequest" for withdraw (first and second steps)',
  })
  @ApiQuery({
    name: 'callback',
    type: String,
    required: true,
    description: 'The LNURL callback confirmation (first step)',
  })
  @ApiQuery({
    name: 'maxWithdrawable',
    type: String,
    required: false,
    description:
      'The maximum withdrawable amount msats confirmation (first step)',
  })
  @ApiQuery({
    name: 'minWithdrawable',
    type: String,
    required: false,
    description:
      'The minimum withdrawable amount msats confirmation (first step)',
  })
  @ApiQuery({
    name: 'defaultDescription',
    type: String,
    required: false,
    description: 'The default description confirmation (first step)',
  })
  @ApiQuery({
    name: 'pr',
    type: String,
    required: false,
    description:
      'bolt11 payment request generated by beneficiary ln wallet (second step)',
  })
  async lnurl(
    @Query('k1') k1: string,
    @Query('tag') tag: string,
    @Query('callback') callback: string,
    @Query('maxWithdrawable') maxWithdrawable: string,
    @Query('minWithdrawable') minWithdrawable: string,
    @Query('defaultDescription') defaultDescription: string,
    @Query('pr') pr: string,
  ) {
    this.logger.log(
      `Received LNURL withdrawal request at ${callback} with k1: ${k1}, tag: ${tag}`,
    );

    // Validate k1 parameter - required for both steps
    if (!k1 || k1.length < 10) {
      this.logger.warn(`Invalid k1 parameter: k1: ${k1}`);
      return {
        status: 'ERROR',
        reason: 'Invalid or missing k1 parameter',
      };
    }

    // For first step, validate tag parameter
    if (tag !== 'withdrawRequest' && !pr) {
      this.logger.warn(`Invalid tag parameter in first step: ${tag}`);
      return {
        status: 'ERROR',
        reason: 'Invalid tag parameter for LNURL withdraw',
      };
    }

    try {
      // Process the LNURL withdrawal using the gRPC service
      const response = await firstValueFrom(
        this.walletService.processLnUrlWithdraw({
          k1,
          tag,
          callback,
          maxWithdrawable,
          minWithdrawable,
          defaultDescription,
          pr,
        }),
      );

      this.logger.log(`LNURL withdrawal response: ${JSON.stringify(response)}`);

      return response;
    } catch (error) {
      this.logger.error(
        `Error processing LNURL withdrawal: ${error.message}`,
        error.stack,
      );

      // Handle different error types more specifically
      if (error.message?.includes('not found')) {
        return {
          status: 'ERROR',
          reason: 'Withdrawal request not found or expired',
        };
      } else if (error.message?.includes('expired')) {
        return {
          status: 'ERROR',
          reason: 'Withdrawal request has expired',
        };
      } else if (error.message?.includes('invoice')) {
        return {
          status: 'ERROR',
          reason: 'Invalid lightning invoice',
        };
      }

      // Generic error fallback that doesn't expose internal details
      return {
        status: 'ERROR',
        reason: 'An error occurred while processing the withdrawal',
      };
    }
  }
}
