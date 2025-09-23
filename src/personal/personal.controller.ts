import {
  Controller,
  Get,
  Post,
  Put,
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

@ApiTags('Personal Savings')
@Controller('personal')
export class PersonalController {
  private readonly logger = new Logger(PersonalController.name);

  constructor(
    private readonly personalWalletService: PersonalWalletService,
    private readonly targetService: TargetService,
    private readonly lockService: LockService,
    private readonly analyticsService: AnalyticsService,
  ) {
    this.logger.log('PersonalController initialized');
  }

  // ========== WALLET MANAGEMENT ==========

  @Post('wallets/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Create a new personal savings wallet',
    description:
      'Creates a new wallet variant (TARGET or LOCKED) for personal savings goals',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiBody({ type: CreateWalletDto })
  @ApiResponse({
    status: 201,
    description: 'Wallet created successfully',
    type: WalletResponseDto,
  })
  @HandleServiceErrors()
  async createWallet(
    @Param('userId') userId: string,
    @Body() createWalletDto: CreateWalletDto,
  ): Promise<WalletResponseDto> {
    this.logger.log(`Creating personal wallet for user: ${userId}`);
    return this.personalWalletService.createWallet(userId, createWalletDto);
  }

  @Get('wallets/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get user wallets',
    description:
      'Retrieve all personal savings wallets for a user with optional filtering',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ type: WalletQueryDto })
  @ApiResponse({
    status: 200,
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

  @Get('wallets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get wallet details',
    description: 'Retrieve detailed information about a specific wallet',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @ApiResponse({
    status: 200,
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

  @Put('wallets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Update wallet settings',
    description: 'Update wallet configuration and settings',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @ApiBody({ type: UpdateWalletDto })
  @ApiResponse({
    status: 200,
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

  @Delete('wallets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Delete wallet',
    description:
      'Delete a personal savings wallet (funds will be transferred to standard wallet)',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @ApiResponse({ status: 204, description: 'Wallet deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @HandleServiceErrors()
  async deleteWallet(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
  ): Promise<void> {
    this.logger.log(`Deleting wallet: ${walletId} for user: ${userId}`);
    await this.personalWalletService.deleteWallet(userId, walletId);
  }

  @Post('wallets/:userId/:walletId/deposit')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Deposit to personal wallet',
    description: 'Deposit funds to a specific personal savings wallet',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @HandleServiceErrors()
  async depositToWallet(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Body() depositDto: DepositFundsRequestDto, // Will use existing DepositFundsRequestDto
  ): Promise<any> {
    this.logger.log(`Depositing to wallet: ${walletId} for user: ${userId}`);
    return this.personalWalletService.depositToWallet({
      ...depositDto,
      userId,
      walletId,
      walletType: WalletType.STANDARD, // TODO: query wallet type from walletId
    });
  }

  @Post('wallets/:userId/:walletId/withdraw')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Withdraw from personal wallet',
    description: 'Withdraw funds from a specific personal savings wallet',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @HandleServiceErrors()
  async withdrawFromWallet(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Body() withdrawDto: WithdrawFundsRequestDto, // Will use existing WithdrawFundsRequestDto
  ): Promise<any> {
    this.logger.log(`Withdrawing from wallet: ${walletId} for user: ${userId}`);
    return this.personalWalletService.withdrawFromWallet({
      ...withdrawDto,
      userId,
      walletId,
      walletType: WalletType.STANDARD,
    });
  }

  // ========== TARGET/SAVINGS GOALS ==========

  @Post('targets/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Create savings target',
    description: 'Create a new savings goal with target amount and date',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiBody({ type: CreateTargetWalletDto })
  @ApiResponse({
    status: 201,
    description: 'Target created successfully',
    type: TargetResponseDto,
  })
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

  @Get('targets/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get user targets',
    description: 'Retrieve all savings targets for a user',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
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

  @Put('targets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Update savings target',
    description: 'Update target amount, date, or other settings',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Target wallet ID' })
  @ApiBody({ type: UpdateTargetDto })
  @ApiResponse({
    status: 200,
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

  @Delete('targets/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Complete/delete savings target',
    description:
      'Mark target as completed and transfer funds to standard wallet',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Target wallet ID' })
  @ApiResponse({ status: 204, description: 'Target completed successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @HandleServiceErrors()
  async completeTarget(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
  ): Promise<void> {
    this.logger.log(`Completing target: ${walletId} for user: ${userId}`);
    // Complete target by marking it as achieved while preserving configuration for historical tracking
    await this.targetService.completeTarget(userId, walletId);
  }

  @Get('targets/:userId/:walletId/progress')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get target progress',
    description: 'Get detailed progress information for a savings target',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Target wallet ID' })
  @HandleServiceErrors()
  async getTargetProgress(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
  ): Promise<any> {
    this.logger.log(`Getting target progress: ${walletId} for user: ${userId}`);
    return this.targetService.getProgress(userId, walletId);
  }

  // ========== LOCKED SAVINGS ==========

  @Post('locked/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Create locked savings',
    description: 'Create a locked savings wallet with specified lock period',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiBody({ type: CreateLockedWalletDto })
  @ApiResponse({
    status: 201,
    description: 'Locked wallet created successfully',
    type: LockedWalletResponseDto,
  })
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
        daysRemaining: 0, // Calculate properly
      },
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  @Get('locked/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get locked wallets',
    description: 'Retrieve all locked savings wallets for a user',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
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

  @Put('locked/:userId/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Update locked wallet settings',
    description: 'Update auto-renewal and other locked wallet settings',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Locked wallet ID' })
  @ApiBody({ type: UpdateLockedWalletDto })
  @ApiResponse({
    status: 200,
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

  @Post('locked/:userId/:walletId/early-withdraw')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Early withdrawal from locked savings',
    description: 'Withdraw from locked savings before maturity (with penalty)',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Locked wallet ID' })
  @ApiBody({ type: EarlyWithdrawDto })
  @HandleServiceErrors()
  async earlyWithdraw(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Body() earlyWithdrawDto: EarlyWithdrawDto,
  ): Promise<any> {
    this.logger.log(
      `Early withdrawal from locked wallet: ${walletId} for user: ${userId}`,
    );
    return this.lockService.performEarlyWithdrawal(
      userId,
      walletId,
      earlyWithdrawDto,
    );
  }

  @Post('locked/:userId/:walletId/renew')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Renew locked savings',
    description: 'Manually renew a locked savings wallet for another period',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Locked wallet ID' })
  @ApiBody({ type: RenewLockDto })
  @HandleServiceErrors()
  async renewLock(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Body() renewLockDto: RenewLockDto,
  ): Promise<LockStatusResponseDto> {
    this.logger.log(`Renewing locked wallet: ${walletId} for user: ${userId}`);
    // Renew lock by updating the lock configuration
    return this.lockService.updateLock(userId, walletId, renewLockDto);
  }

  @Get('locked/:userId/:walletId/status')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get lock status',
    description: 'Get detailed status information about a locked wallet',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Locked wallet ID' })
  @HandleServiceErrors()
  async getLockStatus(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
  ): Promise<any> {
    this.logger.log(`Getting lock status: ${walletId} for user: ${userId}`);
    return this.lockService.getLockStatus(userId, walletId);
  }

  // ========== ANALYTICS AND REPORTING ==========

  @Get('analytics/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get user analytics',
    description: 'Get comprehensive analytics and insights for user savings',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ type: AnalyticsQueryDto })
  @ApiResponse({
    status: 200,
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

  @Get('analytics/:userId/wallet/:walletId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get wallet analytics',
    description: 'Get detailed analytics for a specific wallet',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @ApiQuery({ type: AnalyticsQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Wallet analytics retrieved',
    type: WalletAnalyticsDto,
  })
  @HandleServiceErrors()
  async getWalletAnalytics(
    @Param('userId') userId: string,
    @Param('walletId') walletId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<WalletAnalyticsDto> {
    this.logger.log(
      `Getting wallet analytics: ${walletId} for user: ${userId}`,
    );
    return this.analyticsService.getWalletAnalytics(userId, query);
  }

  @Get('analytics/:userId/summary')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get savings summary',
    description: 'Get a high-level summary of all savings activities',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @HandleServiceErrors()
  async getSavingsSummary(@Param('userId') userId: string): Promise<any> {
    this.logger.log(`Getting savings summary for user: ${userId}`);
    return this.analyticsService.getPortfolioSummary(userId);
  }

  @Get('analytics/:userId/goals')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get goal achievements',
    description: 'Get information about achieved and pending savings goals',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @HandleServiceErrors()
  async getGoalAchievements(@Param('userId') userId: string): Promise<any> {
    this.logger.log(`Getting goal achievements for user: ${userId}`);
    return this.analyticsService.getGoalForecast(userId);
  }

  // ========== TRANSACTION HISTORY ==========

  @Get('transactions/:userId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get transaction history',
    description:
      'Get transaction history for all user personal wallets with filtering and pagination',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'walletId',
    required: false,
    description: 'Filter by specific wallet ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Transaction type filter',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Transaction status filter',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO string)',
  })
  @HandleServiceErrors()
  async getTransactionHistory(
    @Param('userId') userId: string,
    @Query() query: any,
  ): Promise<any> {
    this.logger.log(`Getting transaction history for user: ${userId}`);
    return this.personalWalletService.getTransactionHistory(userId, query);
  }

  @Get('wallet-transactions/:walletId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get wallet transaction history by wallet ID',
    description:
      'Get transaction history for a specific wallet using wallet ID',
  })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Transaction type filter',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Transaction status filter',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO string)',
  })
  @HandleServiceErrors()
  async getWalletTransactionsByWalletId(
    @Param('walletId') walletId: string,
    @Query() query: any,
  ): Promise<any> {
    this.logger.log(`Getting transactions for wallet: ${walletId}`);
    return this.personalWalletService.getWalletTransactionsByWalletId(
      walletId,
      query,
    );
  }

  @Get('transactions/:userId/:transactionId')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get transaction details',
    description: 'Get detailed information about a specific transaction',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'transactionId', description: 'Transaction ID' })
  @HandleServiceErrors()
  async getTransaction(
    @Param('userId') userId: string,
    @Param('transactionId') transactionId: string,
  ): Promise<any> {
    this.logger.log(
      `Getting transaction details: ${transactionId} for user: ${userId}`,
    );
    return this.personalWalletService.getTransaction(userId, transactionId);
  }

  @Get('wallets/:userId/:walletId/transactions')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiSecurity('resource-owner')
  @ApiOperation({
    summary: 'Get wallet transaction history',
    description: 'Get transaction history for a specific wallet',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Transaction type filter',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Transaction status filter',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO string)',
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
