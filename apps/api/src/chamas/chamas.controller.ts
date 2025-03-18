import {
  InviteMembersDto,
  CreateChamaDto,
  JoinChamaDto,
  UpdateChamaDto,
  ChamasServiceClient,
  CHAMAS_SERVICE_NAME,
  ChamaWalletServiceClient,
  CHAMA_WALLET_SERVICE_NAME,
  UpdateChamaTransactionDto,
  ChamaContinueWithdrawDto,
  ChamaContinueDepositDto,
  ChamaWithdrawDto,
  ChamaDepositDto,
  AggregateChamaTransactionsDto,
  JwtAuthGuard,
} from '@bitsacco/common';
import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import {
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
@Controller('chamas')
@UseGuards(JwtAuthGuard)
export class ChamasController {
  private readonly logger = new Logger(ChamasController.name);
  private chamas: ChamasServiceClient;
  private wallet: ChamaWalletServiceClient;

  constructor(
    @Inject(CHAMAS_SERVICE_NAME) private readonly chamasGrpc: ClientGrpc,
    @Inject(CHAMA_WALLET_SERVICE_NAME) private readonly walletGrpc: ClientGrpc,
  ) {
    this.logger.debug('ChamasController initialized');
    this.chamas =
      this.chamasGrpc.getService<ChamasServiceClient>(CHAMAS_SERVICE_NAME);
    this.wallet = this.walletGrpc.getService<ChamaWalletServiceClient>(
      CHAMA_WALLET_SERVICE_NAME,
    );
    this.logger.debug('ChamasController created');
  }

  @Post('create')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create new Chama' })
  @ApiBody({
    type: CreateChamaDto,
  })
  async createChama(@Body() req: CreateChamaDto) {
    return this.chamas.createChama(req);
  }

  @Patch('update')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update existing Chama' })
  @ApiBody({
    type: UpdateChamaDto,
  })
  async updateChama(@Body() req: UpdateChamaDto) {
    return this.chamas.updateChama(req);
  }

  @Post('join')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Join existing Chama' })
  @ApiBody({
    type: JoinChamaDto,
  })
  async joinChama(@Body() req: JoinChamaDto) {
    return this.chamas.joinChama(req);
  }

  @Post('invite')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Invite members to existing Chama' })
  @ApiBody({
    type: InviteMembersDto,
  })
  async inviteMembers(@Body() req: InviteMembersDto) {
    return this.chamas.inviteMembers(req);
  }

  @Get('find/:chamaId')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find existing Chama by ID' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  async findChama(@Param('chamaId') chamaId: string) {
    return this.chamas.findChama({ chamaId });
  }

  @Get('filter/')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Filter existing Chamas by queries' })
  @ApiQuery({
    name: 'memberId',
    type: String,
    required: false,
    description: 'chama member id',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({
    name: 'createdBy',
    type: String,
    required: false,
    description: 'chama created by',
  })
  async filterChama(
    @Query('memberId') memberId: string,
    @Query('createdBy') createdBy: string,
  ) {
    return this.chamas.filterChamas({
      memberId,
      createdBy,
    });
  }

  @Post('tx/deposit')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Chama deposit transaction' })
  @ApiBody({
    type: ChamaDepositDto,
  })
  async deposit(@Body() req: ChamaDepositDto) {
    return this.wallet.deposit(req);
  }

  @Post('tx/deposit/continue')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Continue Chama deposit transaction' })
  @ApiBody({
    type: ChamaContinueDepositDto,
  })
  async continueDeposit(@Body() req: ChamaContinueDepositDto) {
    return this.wallet.continueDeposit(req);
  }

  @Post('tx/withdraw/request')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Chama withdrawal transaction' })
  @ApiBody({
    type: ChamaWithdrawDto,
  })
  async requestWithdraw(@Body() req: ChamaWithdrawDto) {
    return this.wallet.requestWithdraw(req);
  }

  @Post('tx/withdraw/continue')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Continue Chama withdrawal transaction' })
  @ApiBody({
    type: ChamaContinueWithdrawDto,
  })
  async continueWithdraw(@Body() req: ChamaContinueWithdrawDto) {
    return this.wallet.continueWithdraw(req);
  }

  @Patch('tx/update')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update Chama transaction' })
  @ApiBody({
    type: UpdateChamaTransactionDto,
  })
  async updateTransaction(@Body() req: UpdateChamaTransactionDto) {
    return this.wallet.updateTransaction(req);
  }

  @Get('tx/find/:txId')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find Chama transaction by ID' })
  @ApiParam({ name: 'txId', description: 'Transaction ID' })
  async findTransaction(@Param('txId') txId: string) {
    return this.wallet.findTransaction({ txId });
  }

  @Get('tx/filter/')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Filter chama transactions' })
  @ApiQuery({
    name: 'memberId',
    type: String,
    required: false,
    description: 'chama member id',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({
    name: 'chamaId',
    type: String,
    required: false,
    description: 'chama id',
  })
  async filterTransactions(
    @Query('memberId') memberId: string,
    @Query('chamaId') chamaId: string,
  ) {
    return this.wallet.filterTransactions({
      memberId,
      chamaId,
    });
  }

  @Post('tx/aggregate/')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Aggregate chama transactions' })
  @ApiBody({
    type: AggregateChamaTransactionsDto,
  })
  async aggregateTransactions(@Body() req: AggregateChamaTransactionsDto) {
    return this.wallet.aggregateWalletMeta(req);
  }

  @Get('tx/lnurl')
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
      // Process the LNURL withdrawal using the gRPC service
      const response = await firstValueFrom(
        this.wallet.processLnUrlWithdraw({
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
