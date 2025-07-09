import {
  Body,
  Controller,
  Get,
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
  TransactionStatus,
} from '@bitsacco/common';
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
  async findTransaction(@Param('id') id: string, @Req() req: any) {
    // Check if the request has user data
    if (req.user) {
      // Extract user ID from the user object
      const userRecord = req.user as any;
      const userId = userRecord.id;
      return await this.solowalletService.findTransaction({ txId: id, userId });
    }
    return await this.solowalletService.findTransaction({ txId: id });
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
      // Process the LNURL withdrawal using direct service call
      if (!k1) {
        this.logger.error(`Invalid k1: ${k1}`);
        return {
          status: 'ERROR',
          reason: `Invalid k1: ${k1}`,
        };
      }

      // 1. First, find any transaction that's already using this k1 value
      const pendingTx =
        await this.solowalletService.findPendingLnurlWithdrawal(k1);

      // 2. If no pending transaction is found, this is an error
      if (!pendingTx) {
        this.logger.warn(`No pending withdrawal found for k1: ${k1}`);
        return {
          status: 'ERROR',
          reason: 'Withdrawal request not found or expired',
        };
      }

      this.logger.log(
        `Found existing withdrawal transaction: ${pendingTx.id} in status: ${pendingTx.status}`,
      );

      // 3. If transaction is not in pending state, return error
      if (pendingTx.status !== TransactionStatus.PENDING) {
        return {
          status: 'ERROR',
          reason: `LNURL withdrawal is now invalid or expired`,
        };
      }

      // 4. Handle first step of handshake (tag=withdrawRequest && !pr - wallet querying parameters)
      if (tag === 'withdrawRequest' && !pr) {
        this.logger.log('Processing first step of LNURL withdraw handshake');

        // Verify maxWithdrawable matches our expected value (if provided in request)
        if (maxWithdrawable) {
          const expectedMsats = pendingTx.amountMsats;
          if (parseInt(maxWithdrawable) !== expectedMsats) {
            this.logger.error(
              `Mismatched maxWithdrawable: expected ${expectedMsats}, got ${maxWithdrawable}`,
            );
            return {
              status: 'ERROR',
              reason: 'maxWithdrawable exceeds expected amount',
            };
          }
        }

        // Verify callback
        if (callback !== this.configService.getOrThrow('LNURL_CALLBACK')) {
          return {
            status: 'ERROR',
            reason: `LNURL withdrawal has invalid callback`,
          };
        }

        // Return success response for first step
        return {
          tag,
          callback,
          k1,
          defaultDescription,
          minWithdrawable,
          maxWithdrawable,
        };
      }

      // 5. Handle second step of handshake (with invoice)
      if (!pr) {
        this.logger.error(`Invalid Bolt11 invoice: ${pr}`);
        return {
          status: 'ERROR',
          reason: `Invalid Bolt11 invoice: ${pr}`,
        };
      }

      // Process the payment using the existing transaction
      const result = await this.solowalletService.processLnUrlWithdrawCallback(
        k1,
        pr,
      );

      return {
        status: result.success ? 'OK' : 'ERROR',
        reason: result.success ? undefined : result.message,
      };
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
