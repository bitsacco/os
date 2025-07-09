import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CreateChamaDto,
  UpdateChamaTransactionDto,
  ChamaContinueWithdrawDto,
  ChamaContinueDepositDto,
  ChamaWithdrawDto,
  ChamaDepositDto,
  JwtAuthGuard,
  PaginatedRequestDto,
  default_page,
  default_page_size,
  ChamaUpdatesDto,
  ChamaMemberDto,
  MemberInvitesDto,
  ChamaTxMetaRequestDto,
  BulkChamaTxMetaRequestDto,
  ChamaTxStatus,
} from '@bitsacco/common';
import { ConfigService } from '@nestjs/config';
import { ChamasService } from './chamas.service';
import { ChamaWalletService } from '../chamawallet/wallet.service';
import { ChamaMemberGuard, CheckChamaMembership } from './chama-member.guard';
import { ChamaBulkAccessGuard } from './chama-bulk-access.guard';
import { ChamaFilterGuard } from './chama-filter.guard';

@Controller('chamas')
export class ChamasController {
  private readonly logger = new Logger(ChamasController.name);

  constructor(
    private readonly chamasService: ChamasService,
    private readonly chamaWalletService: ChamaWalletService,
    private readonly configService: ConfigService,
  ) {
    this.logger.debug('ChamasController initialized');
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create new Chama' })
  @ApiBody({
    type: CreateChamaDto,
  })
  async createChama(@Body() details: CreateChamaDto) {
    return await this.chamasService.createChama(details);
  }

  @Get()
  @UseGuards(JwtAuthGuard, ChamaFilterGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Filter existing Chamas by queries',
    description:
      'Admins can filter all chamas. Non-admins can only see chamas they are members of.',
  })
  @ApiQuery({
    name: 'memberId',
    type: String,
    required: false,
    description:
      'Chama member ID (automatically set to current user ID for non-admins)',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({
    name: 'createdBy',
    type: String,
    required: false,
    description: 'Chama created by user ID',
  })
  @ApiQuery({
    name: 'page',
    example: '0',
    type: PaginatedRequestDto['page'],
    required: false,
  })
  @ApiQuery({
    name: 'size',
    example: '10',
    type: PaginatedRequestDto['size'],
    required: false,
  })
  async filterChama(
    @Query('memberId') memberId: string,
    @Query('createdBy') createdBy: string,
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ) {
    try {
      // Make sure we're actually calling filterChamas and not findChama
      this.logger.debug('Calling chama service filterChamas method');
      const result = await this.chamasService.filterChamas({
        memberId,
        createdBy,
        pagination: {
          page,
          size,
        },
      });
      this.logger.debug(
        `Filter result: ${result ? 'success' : 'failed'} , ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error filtering chamas: ${error.message}`,
        error.stack,
      );
      // Return empty result instead of throwing an error
      return {
        chamas: [],
        page: page || 0,
        size: size || 10,
        pages: 0,
        total: 0,
      };
    }
  }

  @Patch(':chamaId')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update existing Chama' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiBody({
    type: ChamaUpdatesDto,
  })
  async updateChama(
    @Param('chamaId') chamaId: string,
    @Body() updates: ChamaUpdatesDto,
  ) {
    return this.chamasService.updateChama({ chamaId, updates });
  }

  @Post(':chamaId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Join existing Chama' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiBody({
    type: ChamaMemberDto,
  })
  async joinChama(
    @Param('chamaId') chamaId: string,
    @Body() memberInfo: ChamaMemberDto,
  ) {
    return this.chamasService.joinChama({ chamaId, memberInfo });
  }

  @Post(':chamaId/invite')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Invite members to existing Chama' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiBody({
    type: MemberInvitesDto,
  })
  async inviteMembers(
    @Param('chamaId') chamaId: string,
    @Body() invites: MemberInvitesDto,
  ) {
    return this.chamasService.inviteMembers({ chamaId, ...invites });
  }

  @Get(':chamaId')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get Chama by ID' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  async getChama(@Param('chamaId') chamaId: string) {
    return this.chamasService.findChama({ chamaId });
  }

  @Get(':chamaId/members')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get member profiles for a chama' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  async getMemberProfiles(@Param('chamaId') chamaId: string) {
    try {
      this.logger.debug(`Getting member profiles for chama ${chamaId}`);
      return this.chamasService.getMemberProfiles({ chamaId });
    } catch (error) {
      this.logger.error(
        `Error getting member profiles for chama ${chamaId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post(':chamaId/transactions/deposit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Chama deposit transaction' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiBody({
    type: ChamaDepositDto,
  })
  async deposit(
    @Param('chamaId') chamaId: string,
    @Body() req: ChamaDepositDto,
  ) {
    return this.chamaWalletService.deposit({ ...req, chamaId });
  }

  @Post(':chamaId/transactions/deposit/continue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Continue Chama deposit transaction' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiBody({
    type: ChamaContinueDepositDto,
  })
  async continueDeposit(
    @Param('chamaId') chamaId: string,
    @Body() req: ChamaContinueDepositDto,
  ) {
    return this.chamaWalletService.continueDeposit({ ...req, chamaId });
  }

  @Post(':chamaId/transactions/withdraw')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Chama withdrawal transaction' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiBody({
    type: ChamaWithdrawDto,
  })
  async requestWithdraw(
    @Param('chamaId') chamaId: string,
    @Body() req: ChamaWithdrawDto,
  ) {
    return this.chamaWalletService.requestWithdraw({ ...req, chamaId });
  }

  @Post(':chamaId/transactions/withdraw/continue')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Continue Chama withdrawal transaction' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiBody({
    type: ChamaContinueWithdrawDto,
  })
  async continueWithdraw(
    @Param('chamaId') chamaId: string,
    @Body() req: ChamaContinueWithdrawDto,
  ) {
    return this.chamaWalletService.continueWithdraw({ ...req, chamaId });
  }

  @Patch(':chamaId/transactions/:txId')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update Chama transaction' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiParam({ name: 'txId', description: 'Transaction ID' })
  @ApiBody({
    type: UpdateChamaTransactionDto,
  })
  async updateTransaction(
    @Param('chamaId') chamaId: string,
    @Param('txId') txId: string,
    @Body() req: UpdateChamaTransactionDto,
  ) {
    return this.chamaWalletService.updateTransaction({ ...req, chamaId, txId });
  }

  @Get(':chamaId/transactions/:txId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find Chama transaction by ID' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiParam({ name: 'txId', description: 'Transaction ID' })
  async getTransaction(
    @Param('chamaId') _: string,
    @Param('txId') txId: string,
  ) {
    return this.chamaWalletService.findTransaction({ txId });
  }

  @Get(':chamaId/transactions')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Filter chama transactions' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiQuery({
    name: 'memberId',
    type: String,
    required: false,
    description: 'chama member id',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({
    name: 'page',
    example: '0',
    type: PaginatedRequestDto['page'],
    required: false,
  })
  @ApiQuery({
    name: 'size',
    example: '10',
    type: PaginatedRequestDto['size'],
    required: false,
  })
  async getTransactions(
    @Param('chamaId') chamaId: string,
    @Query('memberId') memberId: string,
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ) {
    return this.chamaWalletService.filterTransactions({
      memberId,
      chamaId,
      pagination: {
        page,
        size,
      },
    });
  }

  @Post(':chamaId/transactions/aggregate')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Aggregate chama transactions' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  @ApiBody({
    type: ChamaTxMetaRequestDto,
  })
  async aggregateWalletMeta(
    @Param('chamaId') chamaId: string,
    @Body() req: ChamaTxMetaRequestDto,
  ) {
    return this.chamaWalletService.aggregateWalletMeta({ ...req, chamaId });
  }

  @Post('transactions/bulk-aggregate')
  @UseGuards(JwtAuthGuard, ChamaBulkAccessGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Aggregate transactions for multiple chamas at once',
    description:
      'For admins: can aggregate data for any chamas. For regular users: can only aggregate data for chamas they are members of. All chamas in the request must be accessible to the user.',
  })
  @ApiBody({
    type: BulkChamaTxMetaRequestDto,
    description:
      'Request body containing a list of chamaIds and optional filtering parameters',
  })
  async aggregateBulkWalletMeta(@Body() req: BulkChamaTxMetaRequestDto) {
    // this.logger.debug(
    //   `Bulk wallet meta aggregation requested for ${req.chamaIds.length} chamas`,
    // );
    return this.chamaWalletService.aggregateBulkWalletMeta(req);
  }

  @Get('lnurl')
  @ApiOperation({ summary: 'Chamawallet LNURL callback' })
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
      // 1. First, find any transaction that's already using this k1 value
      const approvedTx =
        await this.chamaWalletService.findApprovedLnurlWithdrawal(k1);

      // 2. If no pending transaction is found, this is an error
      if (!approvedTx) {
        this.logger.warn(`No pending withdrawal found for k1: ${k1}`);
        return {
          status: 'ERROR',
          reason: 'Withdrawal request not found or expired',
        };
      }

      this.logger.log(
        `Found existing withdrawal transaction: ${approvedTx.id} in status: ${approvedTx.status}`,
      );

      // 3. If transaction is not in pending state, return error
      if (approvedTx.status !== ChamaTxStatus.APPROVED) {
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
          const expectedMsats = approvedTx.amountMsats;
          if (parseInt(maxWithdrawable) > expectedMsats) {
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
      const result = await this.chamaWalletService.processLnUrlWithdrawCallback(
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
