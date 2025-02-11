import {
  InviteMembersDto,
  ChamasService,
  CreateChamaDto,
  JoinChamaDto,
  UpdateChamaDto,
} from '@bitsacco/common';
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@Controller('chamas')
export class ChamasController {
  private readonly logger = new Logger(ChamasController.name);

  constructor(private readonly chamasService: ChamasService) {
    this.logger.debug('ChamasController initialized');
  }

  @Post('create')
  @ApiOperation({ summary: 'Create new Chama' })
  @ApiBody({
    type: CreateChamaDto,
  })
  async createChama(@Body() req: CreateChamaDto) {
    return this.chamasService.createChama(req);
  }

  @Patch('update')
  @ApiOperation({ summary: 'Update existing Chama' })
  @ApiBody({
    type: UpdateChamaDto,
  })
  async updateChama(@Body() req: UpdateChamaDto) {
    return this.chamasService.updateChama(req);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join existing Chama' })
  @ApiBody({
    type: JoinChamaDto,
  })
  async joinChama(@Body() req: JoinChamaDto) {
    return this.chamasService.joinChama(req);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite members to existing Chama' })
  @ApiBody({
    type: InviteMembersDto,
  })
  async inviteMembers(@Body() req: InviteMembersDto) {
    return this.chamasService.inviteMembers(req);
  }

  @Get('find/:chamaId')
  @ApiOperation({ summary: 'Find existing Chama by ID' })
  @ApiParam({ name: 'chamaId', description: 'Chama ID' })
  async findChama(@Param('chamaId') chamaId: string) {
    return this.chamasService.findChama({ chamaId });
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
    return this.chamasService.filterChamas({
      memberId,
      createdBy,
    });
  }
}
