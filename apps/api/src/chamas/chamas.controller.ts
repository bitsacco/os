import {
  InviteMembersDto,
  CreateChamaDto,
  JoinChamaDto,
  UpdateChamaDto,
  ChamasServiceClient,
  CHAMAS_SERVICE_NAME,
  ChamaWalletServiceClient,
  CHAMA_WALLET_SERVICE_NAME,
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
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { ApiBody, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@Controller('chamas')
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
  @ApiOperation({ summary: 'Create new Chama' })
  @ApiBody({
    type: CreateChamaDto,
  })
  async createChama(@Body() req: CreateChamaDto) {
    return this.chamas.createChama(req);
  }

  @Patch('update')
  @ApiOperation({ summary: 'Update existing Chama' })
  @ApiBody({
    type: UpdateChamaDto,
  })
  async updateChama(@Body() req: UpdateChamaDto) {
    return this.chamas.updateChama(req);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join existing Chama' })
  @ApiBody({
    type: JoinChamaDto,
  })
  async joinChama(@Body() req: JoinChamaDto) {
    return this.chamas.joinChama(req);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite members to existing Chama' })
  @ApiBody({
    type: InviteMembersDto,
  })
  async inviteMembers(@Body() req: InviteMembersDto) {
    return this.chamas.inviteMembers(req);
  }

  @Get('find/:chamaId')
  @ApiOperation({ summary: 'Find existing Chama by ID' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  async findChama(@Param('chamaId') chamaId: string) {
    return this.chamas.findChama({ chamaId });
  }

  @Get('filter')
  @ApiOperation({ summary: 'Filter existing Chamas by queries' })
  @ApiQuery({
    name: 'memberId',
    type: String,
    required: false,
    description: 'chama member id',
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

  @Get('find/tx/:id')
  @ApiOperation({ summary: 'Find Chama transaction by ID' })
  @ApiParam({ name: 'txId', description: 'Transaction ID' })
  async findTransaction(@Param('txId') txId: string) {
    return this.wallet.findTransaction({ txId });
  }

  @Get('tx/filter')
  @ApiOperation({ summary: 'Filter chama transactions' })
  @ApiQuery({
    name: 'memberId',
    type: String,
    required: false,
    description: 'chama member id',
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
}
