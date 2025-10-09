import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ChamaDepositDto,
  ChamaContinueDepositDto,
  ChamaWithdrawDto,
  ChamaContinueWithdrawDto,
  UpdateChamaTransactionDto,
  JwtAuthGuard,
  HandleServiceErrors,
  default_page,
  default_page_size,
  CurrentUser,
  ChamaMemberRole,
  type User,
} from '../common';
import {
  CreateChamaDto,
  UpdateChamaDto,
  FilterChamasQueryDto,
  InviteMembersDto,
  AddMembersDto,
  UpdateMemberRolesDto,
} from '../common/dto/chama.dto';
import { ConfigService } from '@nestjs/config';
import { ChamasService } from './chamas.service';
import { ChamaWalletService } from '../chamawallet/wallet.service';
import { ChamaMemberGuard, CheckChamaMembership } from './chama-member.guard';
import { ChamaBulkAccessGuard } from './chama-bulk-access.guard';
import { ChamaFilterGuard } from './chama-filter.guard';

/**
 * ChamasController - REST-compliant API endpoints for chama management
 *
 * This controller demonstrates the v2 REST-compliant pattern with:
 * - Resource-based URLs (e.g., /chamas/:chamaId)
 * - Proper HTTP methods (POST for creation, PATCH for updates)
 * - Resource IDs in URLs, not request bodies
 * - Consistent resource hierarchy (/chamas/:chamaId/members/:memberId)
 *
 * Key improvements from v1:
 * - Chama ID always in URL path for resource operations
 * - Cleaner separation of member operations
 * - Transaction operations under proper resource hierarchy
 * - Query parameters for filtering instead of request bodies
 */
@ApiTags('chamas')
@Controller({
  path: 'chamas',
  version: '2',
})
export class ChamasController {
  private readonly logger = new Logger(ChamasController.name);

  constructor(
    private readonly chamasService: ChamasService,
    private readonly chamaWalletService: ChamaWalletService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('ChamasController initialized - REST-compliant endpoints');
  }

  /**
   * Create new Chama
   * POST /api/v2/chamas
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Create new Chama',
    description:
      'Create a new chama group with optional initial members and invites.',
  })
  @ApiBody({
    type: CreateChamaDto,
    description: 'Chama creation details',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Chama created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async createChama(
    @Body() createChamaDto: CreateChamaDto,
    @CurrentUser() user: User,
  ) {
    this.logger.log(`Creating new chama by user ${user.id}`);

    // Add the creator as the first admin member if not already included
    const members = createChamaDto.members || [];
    const creatorIncluded = members.some((m) => m.userId === user.id);

    if (!creatorIncluded) {
      members.unshift({
        userId: user.id,
        roles: [ChamaMemberRole.Admin, ChamaMemberRole.Member],
      });
    }

    return await this.chamasService.createChama({
      ...createChamaDto,
      members,
      createdBy: user.id,
      invites: createChamaDto.invites || [],
    });
  }

  /**
   * Filter/List Chamas
   * GET /api/v2/chamas
   */
  @Get()
  @UseGuards(JwtAuthGuard, ChamaFilterGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Filter existing Chamas',
    description:
      'List and filter chamas with query parameters. Non-admins can only see chamas they are members of.',
  })
  @ApiQuery({
    name: 'memberId',
    type: String,
    required: false,
    description: 'Filter by member user ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({
    name: 'createdBy',
    type: String,
    required: false,
    description: 'Filter by creator user ID',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number (0-based)',
    example: 0,
  })
  @ApiQuery({
    name: 'size',
    type: Number,
    required: false,
    description: 'Number of items per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chamas retrieved successfully',
  })
  @HandleServiceErrors()
  async filterChamas(
    @Query('memberId') memberId?: string,
    @Query('createdBy') createdBy?: string,
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ) {
    this.logger.log('Filtering chamas');

    try {
      const result = await this.chamasService.filterChamas({
        memberId,
        createdBy,
        pagination: {
          page,
          size,
        },
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Error filtering chamas: ${error.message}`,
        error.stack,
      );
      // Return empty result instead of throwing
      return {
        chamas: [],
        page: page || 0,
        size: size || 10,
        pages: 0,
        total: 0,
      };
    }
  }

  /**
   * Get Chama by ID
   * GET /api/v2/chamas/:chamaId
   */
  @Get(':chamaId')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get Chama by ID',
    description: 'Retrieve detailed information about a specific chama.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chama retrieved successfully',
  })
  @HandleServiceErrors()
  async getChama(@Param('chamaId') chamaId: string) {
    this.logger.log(`Getting chama: ${chamaId}`);
    return this.chamasService.findChama({ chamaId });
  }

  /**
   * Update Chama
   * PATCH /api/v2/chamas/:chamaId
   */
  @Patch(':chamaId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Update existing Chama',
    description: 'Update chama details. Chama ID is in the URL path.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateChamaDto,
    description: 'Chama updates',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chama updated successfully',
  })
  @HandleServiceErrors()
  async updateChama(
    @Param('chamaId') chamaId: string,
    @Body() updateChamaDto: UpdateChamaDto,
  ) {
    this.logger.log(`Updating chama: ${chamaId}`);

    return this.chamasService.updateChama({
      chamaId,
      updates: {
        ...updateChamaDto,
        addMembers: updateChamaDto.addMembers || [],
        updateMembers: updateChamaDto.updateMembers || [],
      },
    });
  }

  /**
   * Join Chama
   * POST /api/v2/chamas/:chamaId/join
   */
  @Post(':chamaId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Join existing Chama',
    description: 'Join a chama as a new member.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    description: 'Member information',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        roles: {
          type: 'array',
          items: { type: 'string', enum: ['Member', 'Admin'] },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully joined chama',
  })
  @HandleServiceErrors()
  async joinChama(
    @Param('chamaId') chamaId: string,
    @Body() memberInfo: { userId: string; roles: string[] },
    @CurrentUser() user: User,
  ) {
    this.logger.log(`User ${user.id} joining chama: ${chamaId}`);

    // Use the authenticated user's ID for the join operation
    const roles = memberInfo.roles?.map((r) =>
      typeof r === 'string'
        ? ChamaMemberRole[r as keyof typeof ChamaMemberRole]
        : r,
    ) || [ChamaMemberRole.Member];

    return this.chamasService.joinChama({
      chamaId,
      memberInfo: {
        userId: user.id,
        roles,
      },
    });
  }

  /**
   * Get Chama Members
   * GET /api/v2/chamas/:chamaId/members
   */
  @Get(':chamaId/members')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get chama members',
    description: 'Retrieve member profiles for a chama.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Members retrieved successfully',
  })
  @HandleServiceErrors()
  async getChamaMembers(@Param('chamaId') chamaId: string) {
    this.logger.log(`Getting members for chama: ${chamaId}`);

    try {
      return await this.chamasService.getMemberProfiles({ chamaId });
    } catch (error) {
      this.logger.error(
        `Error getting member profiles for chama ${chamaId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Add Members to Chama
   * POST /api/v2/chamas/:chamaId/members
   *
   * New in v2 - dedicated endpoint for adding members
   */
  @Post(':chamaId/members')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Add members to chama',
    description: 'Add new members to an existing chama.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: AddMembersDto,
    description: 'Members to add',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Members added successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async addMembers(
    @Param('chamaId') chamaId: string,
    @Body() addMembersDto: AddMembersDto,
  ) {
    this.logger.log(`Adding members to chama: ${chamaId}`);

    // Use the update service to add members
    return this.chamasService.updateChama({
      chamaId,
      updates: {
        addMembers: addMembersDto.members,
        updateMembers: [],
      },
    });
  }

  /**
   * Update Member Roles
   * PATCH /api/v2/chamas/:chamaId/members/:memberId
   *
   * New in v2 - granular endpoint for updating member roles
   */
  @Patch(':chamaId/members/:memberId')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Update member roles',
    description: 'Update roles for a specific chama member.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'memberId',
    description: 'Member user ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: UpdateMemberRolesDto,
    description: 'New roles for the member',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member roles updated successfully',
  })
  @HandleServiceErrors()
  async updateMemberRoles(
    @Param('chamaId') chamaId: string,
    @Param('memberId') memberId: string,
    @Body() updateRolesDto: UpdateMemberRolesDto,
  ) {
    this.logger.log(
      `Updating roles for member ${memberId} in chama ${chamaId}`,
    );

    return this.chamasService.updateChama({
      chamaId,
      updates: {
        addMembers: [],
        updateMembers: [
          {
            userId: memberId,
            roles: updateRolesDto.roles,
          },
        ],
      },
    });
  }

  /**
   * Remove Member from Chama
   * DELETE /api/v2/chamas/:chamaId/members/:memberId
   *
   * New in v2 - proper DELETE endpoint for removing members
   */
  @Delete(':chamaId/members/:memberId')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Remove member from chama',
    description: 'Remove a member from the chama.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'memberId',
    description: 'Member user ID to remove',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Member removed successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @HandleServiceErrors()
  async removeMember(
    @Param('chamaId') chamaId: string,
    @Param('memberId') memberId: string,
  ) {
    this.logger.log(`Removing member ${memberId} from chama ${chamaId}`);

    // Note: This would need a new service method for removing members
    // For now, we can update with empty roles which effectively removes them
    await this.chamasService.updateChama({
      chamaId,
      updates: {
        addMembers: [],
        updateMembers: [
          {
            userId: memberId,
            roles: [], // Empty roles effectively removes the member
          },
        ],
      },
    });
  }

  /**
   * Invite Members to Chama
   * POST /api/v2/chamas/:chamaId/invites
   */
  @Post(':chamaId/invites')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Invite members to chama',
    description: 'Send invitations to join the chama.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: InviteMembersDto,
    description: 'Invitations to send',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invitations sent successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async inviteMembers(
    @Param('chamaId') chamaId: string,
    @Body() inviteMembersDto: InviteMembersDto,
  ) {
    this.logger.log(`Inviting members to chama: ${chamaId}`);

    return this.chamasService.inviteMembers({
      chamaId,
      ...inviteMembersDto,
    });
  }

  // ========== WALLET/TRANSACTION OPERATIONS ==========

  /**
   * Deposit to Chama Wallet
   * POST /api/v2/chamas/:chamaId/wallet/deposit
   */
  @Post(':chamaId/wallet/deposit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Deposit to chama wallet',
    description: 'Initiate a deposit transaction to the chama wallet.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: ChamaDepositDto,
    description: 'Deposit details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposit initiated successfully',
  })
  @HandleServiceErrors()
  async deposit(
    @Param('chamaId') chamaId: string,
    @Body() depositDto: ChamaDepositDto,
  ) {
    this.logger.log(`Depositing to chama wallet: ${chamaId}`);

    return this.chamaWalletService.deposit({
      ...depositDto,
      chamaId,
    });
  }

  /**
   * Continue Deposit Transaction
   * POST /api/v2/chamas/:chamaId/wallet/deposit/continue
   */
  @Post(':chamaId/wallet/deposit/continue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Continue deposit transaction',
    description: 'Continue a pending deposit transaction.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: ChamaContinueDepositDto,
    description: 'Continue deposit details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposit continued successfully',
  })
  @HandleServiceErrors()
  async continueDeposit(
    @Param('chamaId') chamaId: string,
    @Body() continueDepositDto: ChamaContinueDepositDto,
  ) {
    this.logger.log(`Continuing deposit for chama: ${chamaId}`);

    return this.chamaWalletService.continueDeposit({
      ...continueDepositDto,
      chamaId,
    });
  }

  /**
   * Withdraw from Chama Wallet
   * POST /api/v2/chamas/:chamaId/wallet/withdraw
   */
  @Post(':chamaId/wallet/withdraw')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Withdraw from chama wallet',
    description: 'Request a withdrawal from the chama wallet.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: ChamaWithdrawDto,
    description: 'Withdrawal details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Withdrawal initiated successfully',
  })
  @HandleServiceErrors()
  async requestWithdraw(
    @Param('chamaId') chamaId: string,
    @Body() withdrawDto: ChamaWithdrawDto,
  ) {
    this.logger.log(`Withdrawing from chama wallet: ${chamaId}`);

    return this.chamaWalletService.requestWithdraw({
      ...withdrawDto,
      chamaId,
    });
  }

  /**
   * Continue Withdrawal Transaction
   * POST /api/v2/chamas/:chamaId/wallet/withdraw/continue
   */
  @Post(':chamaId/wallet/withdraw/continue')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Continue withdrawal transaction',
    description: 'Continue a pending withdrawal transaction.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: ChamaContinueWithdrawDto,
    description: 'Continue withdrawal details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Withdrawal continued successfully',
  })
  @HandleServiceErrors()
  async continueWithdraw(
    @Param('chamaId') chamaId: string,
    @Body() continueWithdrawDto: ChamaContinueWithdrawDto,
  ) {
    this.logger.log(`Continuing withdrawal for chama: ${chamaId}`);

    return this.chamaWalletService.continueWithdraw({
      ...continueWithdrawDto,
      chamaId,
    });
  }

  /**
   * Get Chama Transactions
   * GET /api/v2/chamas/:chamaId/transactions
   */
  @Get(':chamaId/transactions')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get chama transactions',
    description: 'Filter and retrieve chama transactions.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'memberId',
    type: String,
    required: false,
    description: 'Filter by member ID',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number',
    example: 0,
  })
  @ApiQuery({
    name: 'size',
    type: Number,
    required: false,
    description: 'Page size',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transactions retrieved successfully',
  })
  @HandleServiceErrors()
  async getTransactions(
    @Param('chamaId') chamaId: string,
    @Query('memberId') memberId?: string,
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ) {
    this.logger.log(`Getting transactions for chama: ${chamaId}`);

    return this.chamaWalletService.filterTransactions({
      memberId,
      chamaId,
      pagination: {
        page,
        size,
      },
    });
  }

  /**
   * Get Transaction by ID
   * GET /api/v2/chamas/:chamaId/transactions/:txId
   */
  @Get(':chamaId/transactions/:txId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get transaction by ID',
    description: 'Retrieve a specific chama transaction.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'txId',
    description: 'Transaction ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction retrieved successfully',
  })
  @HandleServiceErrors()
  async getTransaction(
    @Param('chamaId') _chamaId: string,
    @Param('txId') txId: string,
  ) {
    this.logger.log(`Getting transaction: ${txId}`);

    return this.chamaWalletService.findTransaction({ txId });
  }

  /**
   * Update Transaction
   * PATCH /api/v2/chamas/:chamaId/transactions/:txId
   */
  @Patch(':chamaId/transactions/:txId')
  @UseGuards(JwtAuthGuard, ChamaMemberGuard)
  @CheckChamaMembership({ chamaIdField: 'chamaId' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Update chama transaction',
    description: 'Update a chama transaction status or details.',
  })
  @ApiParam({
    name: 'chamaId',
    description: 'Chama ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'txId',
    description: 'Transaction ID',
  })
  @ApiBody({
    type: UpdateChamaTransactionDto,
    description: 'Transaction updates',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction updated successfully',
  })
  @HandleServiceErrors()
  async updateTransaction(
    @Param('chamaId') chamaId: string,
    @Param('txId') txId: string,
    @Body() updateTxDto: UpdateChamaTransactionDto,
  ) {
    this.logger.log(`Updating transaction ${txId} for chama ${chamaId}`);

    return this.chamaWalletService.updateTransaction({
      ...updateTxDto,
      chamaId,
      txId,
    });
  }
}
