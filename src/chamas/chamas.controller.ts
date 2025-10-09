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
} from '../common';
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
  @UseGuards(JwtAuthGuard)
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
}
