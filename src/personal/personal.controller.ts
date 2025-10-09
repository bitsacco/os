import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiSecurity,
  ApiResponse,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  ResourceOwnerGuard,
  CheckOwnership,
  HandleServiceErrors,
  WalletType,
  DepositFundsRequestDto,
  WithdrawFundsRequestDto,
} from '../common';
import {
  PersonalWalletService,
  TargetService,
  LockService,
  AnalyticsService,
} from './services';
import {
  CreateWalletDto,
  CreateTargetWalletDto,
  UpdateWalletDto,
  WalletQueryDto,
  WalletResponseDto,
  WalletListResponseDto,
  UpdateTargetDto,
  TargetResponseDto,
  CreateLockedWalletDto,
  UpdateLockedWalletDto,
  LockedWalletResponseDto,
  LockStatusResponseDto,
  EarlyWithdrawDto,
  RenewLockDto,
  AnalyticsQueryDto,
  WalletAnalyticsDto,
  UserAnalyticsDto,
} from './dto';

/**
 * PersonalController - REST-compliant API endpoints for personal savings
 *
 * This controller is already 100% REST-compliant in v1, so v2 mainly:
 * - Uses version: '2' for clear versioning
 * - Maintains the same excellent REST patterns from v1
 * - Provides consistent experience with other v2 controllers
 *
 * The personal controller was already well-designed with:
 * - Resource-based URLs (/wallets/:userId/:walletId)
 * - Proper HTTP methods
 * - Resource IDs in URL paths
 * - Clean resource hierarchy
 */
@ApiTags('personal')
@Controller({
  path: 'personal',
  version: '2',
})
export class PersonalController {
  private readonly logger = new Logger(PersonalController.name);

  constructor(
    private readonly personalWalletService: PersonalWalletService,
    private readonly targetService: TargetService,
    private readonly lockService: LockService,
    private readonly analyticsService: AnalyticsService,
  ) {
    this.logger.log(
      'PersonalController initialized - REST-compliant endpoints',
    );
  }

  // ========== WALLET MANAGEMENT ==========

  /**
   * Create personal wallet
   * POST /api/v2/personal/wallets/:userId

   */
  @Post('wallets/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Create a new personal savings wallet',
    description:
      'Creates a new wallet variant (TARGET or LOCKED) for personal savings goals.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: CreateWalletDto,
    description: 'Wallet creation details',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Wallet created successfully',
    type: WalletResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async createWallet(
    @Param('userId') userId: string,
    @Body() createWalletDto: CreateWalletDto,
  ): Promise<WalletResponseDto> {
    this.logger.log(`Creating personal wallet for user: ${userId}`);
    return this.personalWalletService.createWallet(userId, createWalletDto);
  }

  /**
   * Get user wallets
   * GET /api/v2/personal/wallets/:userId

   */
  @Get('wallets/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get user wallets',
    description:
      'Retrieve all personal savings wallets for a user with optional filtering.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({ type: WalletQueryDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User wallets retrieved',
    type: WalletListResponseDto,
  })
  @HandleServiceErrors()
  async getUserWallets(
    @Param('userId') userId: string,
    @Query() query: WalletQueryDto,
  ): Promise<WalletListResponseDto> {
    this.logger.log(`Getting wallets for user: ${userId}`);
    return this.personalWalletService.getWallets(userId, query);
  }

  /**
   * Get wallet details
   * GET /api/v2/personal/wallets/:userId/:walletId

   */
  @Get('wallets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get wallet details',
    description: 'Retrieve detailed information about a specific wallet.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet ID',
    example: 'wallet_123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet details retrieved',
    type: WalletResponseDto,
  })
  @HandleServiceErrors()
  async getWalletDetails(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
  ): Promise<WalletResponseDto> {
    this.logger.log(`Getting wallet details: ${walletId} for user: ${userId}`);
    return this.personalWalletService.getWallet(userId, walletId);
  }

  /**
   * Update wallet
   * PATCH /api/v2/personal/wallets/:userId/:walletId

   */
  @Patch('wallets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Update wallet settings',
    description: 'Update wallet configuration and settings.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet ID',
    example: 'wallet_123',
  })
  @ApiBody({
    type: UpdateWalletDto,
    description: 'Wallet updates',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet updated successfully',
    type: WalletResponseDto,
  })
  @HandleServiceErrors()
  async updateWallet(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Body() updateWalletDto: UpdateWalletDto,
  ): Promise<WalletResponseDto> {
    this.logger.log(`Updating wallet: ${walletId} for user: ${userId}`);
    return this.personalWalletService.updateWallet(
      userId,
      walletId,
      updateWalletDto,
    );
  }

  /**
   * Delete wallet
   * DELETE /api/v2/personal/wallets/:userId/:walletId

   */
  @Delete('wallets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Delete wallet',
    description:
      'Delete a personal savings wallet (funds will be transferred to standard wallet).',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet ID',
    example: 'wallet_123',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Wallet deleted successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @HandleServiceErrors()
  async deleteWallet(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
  ): Promise<void> {
    this.logger.log(`Deleting wallet: ${walletId} for user: ${userId}`);
    await this.personalWalletService.deleteWallet(userId, walletId);
  }

  /**
   * Deposit to wallet
   * POST /api/v2/personal/wallets/:userId/:walletId/deposit

   */
  @Post('wallets/:userId/:walletId/deposit')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Deposit to personal wallet',
    description: 'Deposit funds to a specific personal savings wallet.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet ID',
    example: 'wallet_123',
  })
  @ApiBody({
    type: DepositFundsRequestDto,
    description: 'Deposit details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposit successful',
  })
  @HandleServiceErrors()
  async depositToWallet(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Body() depositDto: DepositFundsRequestDto,
  ): Promise<any> {
    this.logger.log(`Depositing to wallet: ${walletId} for user: ${userId}`);
    return this.personalWalletService.depositToWallet({
      ...depositDto,
      userId,
      walletId,
    });
  }

  /**
   * Withdraw from wallet
   * POST /api/v2/personal/wallets/:userId/:walletId/withdraw

   */
  @Post('wallets/:userId/:walletId/withdraw')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Withdraw from personal wallet',
    description: 'Withdraw funds from a specific personal savings wallet.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet ID',
    example: 'wallet_123',
  })
  @ApiBody({
    type: WithdrawFundsRequestDto,
    description: 'Withdrawal details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Withdrawal successful',
  })
  @HandleServiceErrors()
  async withdrawFromWallet(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Body() withdrawDto: WithdrawFundsRequestDto,
  ): Promise<any> {
    this.logger.log(`Withdrawing from wallet: ${walletId} for user: ${userId}`);
    return this.personalWalletService.withdrawFromWallet({
      ...withdrawDto,
      userId,
      walletId,
    });
  }

  // ========== TARGET/SAVINGS GOALS ==========

  /**
   * Create savings target
   * POST /api/v2/personal/targets/:userId

   */
  @Post('targets/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Create savings target',
    description: 'Create a new savings goal with target amount and date.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: CreateTargetWalletDto,
    description: 'Target creation details',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Target created successfully',
    type: TargetResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async createTarget(
    @Param('userId') userId: string,
    @Body() createTargetDto: CreateTargetWalletDto,
  ): Promise<TargetResponseDto> {
    this.logger.log(`Creating target for user: ${userId}`);
    const wallet = await this.personalWalletService.createWallet(
      userId,
      createTargetDto,
    );

    // Convert the wallet response to target response format
    return {
      currentAmount: wallet.balance || 0,
      targetAmount: createTargetDto.targetAmountMsats || 0,
      progressPercentage: 0,
      remainingAmount: createTargetDto.targetAmountMsats || 0,
      targetDate: createTargetDto.targetDate,
      milestoneReached: [],
    };
  }

  /**
   * Get user targets
   * GET /api/v2/personal/targets/:userId

   */
  @Get('targets/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get user targets',
    description: 'Retrieve all savings targets for a user.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User targets retrieved',
    type: [TargetResponseDto],
  })
  @HandleServiceErrors()
  async getUserTargets(
    @Param('userId') userId: string,
  ): Promise<TargetResponseDto[]> {
    this.logger.log(`Getting targets for user: ${userId}`);
    return this.targetService.getUserTargets(userId);
  }

  /**
   * Update savings target
   * PATCH /api/v2/personal/targets/:userId/:walletId

   */
  @Patch('targets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Update savings target',
    description: 'Update target amount, date, or other settings.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Target wallet ID',
    example: 'wallet_123',
  })
  @ApiBody({
    type: UpdateTargetDto,
    description: 'Target updates',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Target updated successfully',
    type: TargetResponseDto,
  })
  @HandleServiceErrors()
  async updateTarget(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Body() updateTargetDto: UpdateTargetDto,
  ): Promise<TargetResponseDto> {
    this.logger.log(`Updating target: ${walletId} for user: ${userId}`);
    return this.targetService.updateTarget(userId, walletId, updateTargetDto);
  }

  /**
   * Complete/Delete target
   * DELETE /api/v2/personal/targets/:userId/:walletId

   */
  @Delete('targets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Complete/delete savings target',
    description:
      'Mark target as completed and transfer funds to standard wallet.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Target wallet ID',
    example: 'wallet_123',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Target completed successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @HandleServiceErrors()
  async completeTarget(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
  ): Promise<void> {
    this.logger.log(`Completing target: ${walletId} for user: ${userId}`);
    await this.targetService.completeTarget(userId, walletId);
  }

  /**
   * Get target progress
   * GET /api/v2/personal/targets/:userId/:walletId/progress

   */
  @Get('targets/:userId/:walletId/progress')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get target progress',
    description: 'Get detailed progress information for a savings target.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Target wallet ID',
    example: 'wallet_123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Target progress retrieved',
  })
  @HandleServiceErrors()
  async getTargetProgress(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
  ): Promise<any> {
    this.logger.log(`Getting target progress: ${walletId} for user: ${userId}`);
    return this.targetService.getProgress(userId, walletId);
  }

  // ========== LOCKED SAVINGS ==========

  /**
   * Create locked savings
   * POST /api/v2/personal/locked/:userId

   */
  @Post('locked/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Create locked savings',
    description: 'Create a locked savings wallet with specified lock period.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: CreateLockedWalletDto,
    description: 'Locked wallet creation details',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Locked wallet created successfully',
    type: LockedWalletResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async createLockedWallet(
    @Param('userId') userId: string,
    @Body() createLockedDto: CreateLockedWalletDto,
  ): Promise<LockedWalletResponseDto> {
    this.logger.log(`Creating locked wallet for user: ${userId}`);
    const wallet = await this.personalWalletService.createWallet(
      userId,
      createLockedDto,
    );

    // Return in LockedWalletResponseDto format
    return {
      walletId: wallet.walletId,
      userId: wallet.userId,
      walletType: WalletType.LOCKED,
      walletName: wallet.walletName,
      balance: wallet.balance || 0,
      lockPeriod: createLockedDto.lockPeriod,
      lockEndDate: createLockedDto.lockEndDate || new Date(),
      autoRenew: createLockedDto.autoRenew || false,
      penaltyRate: createLockedDto.penaltyRate,
      lockInfo: {
        lockPeriod: createLockedDto.lockPeriod,
        lockEndDate: createLockedDto.lockEndDate || new Date(),
        isLocked: true,
        autoRenew: createLockedDto.autoRenew || false,
        penaltyRate: createLockedDto.penaltyRate || 0,
        canWithdrawEarly: true,
        daysRemaining: 0, // Calculate properly in service
      },
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * Get locked wallets
   * GET /api/v2/personal/locked/:userId

   */
  @Get('locked/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get locked wallets',
    description: 'Retrieve all locked savings wallets for a user.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Locked wallets retrieved',
    type: [LockStatusResponseDto],
  })
  @HandleServiceErrors()
  async getLockedWallets(
    @Param('userId') userId: string,
  ): Promise<LockStatusResponseDto[]> {
    this.logger.log(`Getting locked wallets for user: ${userId}`);
    return this.lockService.getUserLockedWallets(userId);
  }

  /**
   * Update locked wallet
   * PATCH /api/v2/personal/locked/:userId/:walletId

   */
  @Patch('locked/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Update locked wallet settings',
    description: 'Update auto-renewal and other locked wallet settings.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Locked wallet ID',
    example: 'wallet_123',
  })
  @ApiBody({
    type: UpdateLockedWalletDto,
    description: 'Locked wallet updates',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Locked wallet updated successfully',
    type: LockStatusResponseDto,
  })
  @HandleServiceErrors()
  async updateLockedWallet(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Body() updateLockedDto: UpdateLockedWalletDto,
  ): Promise<LockStatusResponseDto> {
    this.logger.log(`Updating locked wallet: ${walletId} for user: ${userId}`);
    return this.lockService.updateLock(userId, walletId, updateLockedDto);
  }

  // ========== ANALYTICS AND REPORTING ==========

  /**
   * Get user analytics
   * GET /api/v2/personal/analytics/:userId

   */
  @Get('analytics/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get user analytics',
    description: 'Get comprehensive analytics and insights for user savings.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({ type: AnalyticsQueryDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics retrieved',
    type: UserAnalyticsDto,
  })
  @HandleServiceErrors()
  async getUserAnalytics(
    @Param('userId') userId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<UserAnalyticsDto> {
    this.logger.log(`Getting analytics for user: ${userId}`);
    return this.analyticsService.getWalletAnalytics(userId, query);
  }

  // ========== TRANSACTION HISTORY ==========

  /**
   * Get transaction history
   * GET /api/v2/personal/transactions/:userId

   */
  @Get('transactions/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get transaction history',
    description:
      'Get transaction history for all user personal wallets with filtering and pagination.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({
    name: 'walletId',
    required: false,
    description: 'Filter by specific wallet ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20)',
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transactions retrieved',
  })
  @HandleServiceErrors()
  async getTransactionHistory(
    @Param('userId') userId: string,
    @Query() query: any,
  ): Promise<any> {
    this.logger.log(`Getting transaction history for user: ${userId}`);
    return this.personalWalletService.getTransactionHistory(userId, query);
  }

  /**
   * Get wallet transactions
   * GET /api/v2/personal/wallets/:userId/:walletId/transactions

   */
  @Get('wallets/:userId/:walletId/transactions')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get wallet transaction history',
    description: 'Get transaction history for a specific wallet.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet ID',
    example: 'wallet_123',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20)',
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet transactions retrieved',
  })
  @HandleServiceErrors()
  async getWalletTransactions(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Query() query: any,
  ): Promise<any> {
    this.logger.log(
      `Getting wallet transactions: ${walletId} for user: ${userId}`,
    );
    return this.personalWalletService.getWalletTransactions(
      userId,
      walletId,
      query,
    );
  }
}
