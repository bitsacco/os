import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PersonalController } from './personal.controller';
import {
  PersonalWalletService,
  TargetService,
  LockService,
  AnalyticsService,
} from './services';
import {
  WalletType,
  LockPeriod,
  JwtAuthGuard,
  ResourceOwnerGuard,
} from '../common';

describe('PersonalController', () => {
  let controller: PersonalController;
  let personalWalletService: jest.Mocked<PersonalWalletService>;
  let targetService: jest.Mocked<TargetService>;
  let lockService: jest.Mocked<LockService>;
  let analyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(async () => {
    const mockPersonalWalletService = {
      createWallet: jest.fn(),
      getWallets: jest.fn(),
      getWallet: jest.fn(),
      updateWallet: jest.fn(),
      deleteWallet: jest.fn(),
      depositToWallet: jest.fn(),
      withdrawFromWallet: jest.fn(),
      getWalletBalance: jest.fn(),
    };

    const mockTargetService = {
      createTarget: jest.fn(),
      getUserTargets: jest.fn(),
      updateTarget: jest.fn(),
      completeTarget: jest.fn(),
      getTargetProgress: jest.fn(),
    };

    const mockLockService = {
      createLockedWallet: jest.fn(),
      getUserLockedWallets: jest.fn(),
      updateLockedWallet: jest.fn(),
      earlyWithdraw: jest.fn(),
      renewLock: jest.fn(),
      getLockStatus: jest.fn(),
    };

    const mockAnalyticsService = {
      getUserAnalytics: jest.fn(),
      getWalletAnalytics: jest.fn(),
      getSavingsSummary: jest.fn(),
      getGoalAchievements: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonalController],
      providers: [
        { provide: PersonalWalletService, useValue: mockPersonalWalletService },
        { provide: TargetService, useValue: mockTargetService },
        { provide: LockService, useValue: mockLockService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
            getAll: jest.fn(),
            getAllAndOverride: jest.fn(),
            getAllAndMerge: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .overrideGuard(ResourceOwnerGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .compile();

    controller = module.get<PersonalController>(PersonalController);
    personalWalletService = module.get(PersonalWalletService);
    targetService = module.get(TargetService);
    lockService = module.get(LockService);
    analyticsService = module.get(AnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createWallet', () => {
    it('should create a target wallet', async () => {
      const createWalletDto = {
        userId: 'user123',
        walletType: WalletType.TARGET,
        walletName: 'Emergency Fund',
        targetAmount: 100000,
        targetDate: new Date('2024-12-31'),
      };

      const expectedResponse = {
        walletId: 'wallet123',
        userId: 'user123',
        walletType: WalletType.TARGET,
        walletName: 'Emergency Fund',
        currentBalance: 0,
        targetAmount: 100000,
        progressPercentage: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      personalWalletService.createWallet.mockResolvedValue(expectedResponse);

      const result = await controller.createWallet('user123', createWalletDto);

      expect(personalWalletService.createWallet).toHaveBeenCalledWith(
        'user123',
        createWalletDto,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should create a locked wallet', async () => {
      const createWalletDto = {
        userId: 'user123',
        walletType: WalletType.LOCKED,
        walletName: 'Long-term Savings',
        lockPeriod: LockPeriod.SIX_MONTHS,
        autoRenew: false,
      };

      const expectedResponse = {
        walletId: 'wallet456',
        userId: 'user123',
        walletType: WalletType.LOCKED,
        walletName: 'Long-term Savings',
        currentBalance: 0,
        lockPeriod: LockPeriod.SIX_MONTHS,
        lockEndDate: new Date(),
        isLocked: true,
        autoRenew: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      personalWalletService.createWallet.mockResolvedValue(expectedResponse);

      const result = await controller.createWallet('user123', createWalletDto);

      expect(personalWalletService.createWallet).toHaveBeenCalledWith(
        'user123',
        createWalletDto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getUserWallets', () => {
    it('should return user wallets with filtering', async () => {
      const userId = 'user123';
      const query = { walletType: WalletType.TARGET };

      const expectedWallets = [
        {
          walletId: 'wallet123',
          userId: 'user123',
          walletType: WalletType.TARGET,
          walletName: 'Emergency Fund',
          currentBalance: 50000,
          targetAmount: 100000,
          progressPercentage: 50,
        },
      ];

      personalWalletService.getWallets.mockResolvedValue(expectedWallets);

      const result = await controller.getUserWallets(userId, query);

      expect(personalWalletService.getWallets).toHaveBeenCalledWith(
        userId,
        query,
      );
      expect(result).toEqual(expectedWallets);
    });
  });

  describe('getWalletDetails', () => {
    it('should return detailed wallet information', async () => {
      const userId = 'user123';
      const walletId = 'wallet123';

      const expectedDetails = {
        walletId: 'wallet123',
        userId: 'user123',
        walletType: WalletType.TARGET,
        walletName: 'Emergency Fund',
        currentBalance: 75000,
        targetAmount: 100000,
        progressPercentage: 75,
        progress: {
          currentAmount: 75000,
          targetAmount: 100000,
          progressPercentage: 75,
          milestoneReached: [],
        },
      };

      personalWalletService.getWallet.mockResolvedValue(expectedDetails);

      const result = await controller.getWalletDetails(userId, walletId);

      expect(personalWalletService.getWallet).toHaveBeenCalledWith(
        userId,
        walletId,
      );
      expect(result).toEqual(expectedDetails);
    });
  });

  describe('createTarget', () => {
    it('should create a savings target', async () => {
      const createTargetDto = {
        userId: 'user123',
        walletName: 'Vacation Fund',
        targetAmountMsats: 200000,
        targetDate: new Date('2024-06-01'),
      };

      const walletResponse = {
        walletId: 'target123',
        userId: 'user123',
        walletType: WalletType.TARGET,
        walletName: 'Vacation Fund',
        balance: 0,
        targetAmount: 200000,
        targetDate: new Date('2024-06-01'),
        currentBalance: 0,
        progressPercentage: 0,
      };

      const expectedResponse = {
        currentAmount: 0,
        targetAmount: 200000,
        progressPercentage: 0,
        remainingAmount: 200000,
        targetDate: new Date('2024-06-01'),
        milestoneReached: [],
      };

      personalWalletService.createWallet.mockResolvedValue(walletResponse);

      const result = await controller.createTarget('user123', createTargetDto);

      expect(personalWalletService.createWallet).toHaveBeenCalledWith(
        'user123',
        createTargetDto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('createLockedWallet', () => {
    it('should create a locked savings wallet', async () => {
      const lockEndDate = new Date();
      const createLockedDto = {
        userId: 'user123',
        walletName: 'Retirement Savings',
        lockPeriod: LockPeriod.ONE_YEAR,
        lockEndDate: lockEndDate,
        autoRenew: true,
        penaltyRate: 5,
      };

      const walletResponse = {
        walletId: 'locked123',
        userId: 'user123',
        walletType: WalletType.LOCKED,
        walletName: 'Retirement Savings',
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const expectedResponse = {
        walletId: 'locked123',
        userId: 'user123',
        walletType: WalletType.LOCKED,
        walletName: 'Retirement Savings',
        balance: 0,
        lockPeriod: LockPeriod.ONE_YEAR,
        lockEndDate: lockEndDate,
        autoRenew: true,
        penaltyRate: 5,
        lockInfo: {
          lockPeriod: LockPeriod.ONE_YEAR,
          lockEndDate: lockEndDate,
          isLocked: true,
          autoRenew: true,
          penaltyRate: 5,
          canWithdrawEarly: true,
          daysRemaining: 0,
        },
        createdAt: walletResponse.createdAt,
        updatedAt: walletResponse.updatedAt,
      };

      personalWalletService.createWallet.mockResolvedValue(walletResponse);

      const result = await controller.createLockedWallet(
        'user123',
        createLockedDto,
      );

      expect(personalWalletService.createWallet).toHaveBeenCalledWith(
        'user123',
        createLockedDto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getUserAnalytics', () => {
    it('should return comprehensive user analytics', async () => {
      const userId = 'user123';
      const query = { timeRange: '6M' };

      const expectedAnalytics = {
        totalBalance: 500000,
        totalSavings: 300000,
        totalLocked: 200000,
        totalTargets: 100000,
        goalsAchieved: 2,
        activeGoals: 3,
        portfolioDistribution: {
          standard: 200000,
          target: 100000,
          locked: 200000,
        },
        monthlyGrowth: [
          { month: '2024-01', amount: 50000 },
          { month: '2024-02', amount: 75000 },
        ],
      };

      analyticsService.getWalletAnalytics.mockResolvedValue(expectedAnalytics);

      const result = await controller.getUserAnalytics(userId, query);

      expect(analyticsService.getWalletAnalytics).toHaveBeenCalledWith(
        userId,
        query,
      );
      expect(result).toEqual(expectedAnalytics);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      const createWalletDto = {
        userId: 'user123',
        walletType: WalletType.TARGET,
        walletName: 'Test Wallet',
        targetAmount: 100000,
      };

      personalWalletService.createWallet.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        controller.createWallet('user123', createWalletDto),
      ).rejects.toThrow('Service error');
    });
  });
});
