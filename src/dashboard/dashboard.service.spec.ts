import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { BusinessMetricsService } from '../common/monitoring/business.metrics';
import { SharesMetricsService } from '../shares/shares.metrics';
import { ChamaMetricsService } from '../chamas/chama.metrics';
import { TransactionMetricsService } from '../common/monitoring/transaction.metrics';
import { SwapMetricsService } from '../swap/metrics/swap.metrics';
import { PersonalMetricsService } from '../personal/services/personal.metrics';
import { NotificationMetrics } from '../notifications/notification.metrics';
import { NostrMetricsService } from '../nostr/nostr.metrics';
import { LnurlMetricsService } from '../lnurl/lnurl.metrics';
import { AuthMetricsService } from '../auth/metrics/auth.metrics';

describe('DashboardService', () => {
  let service: DashboardService;
  let businessMetrics: jest.Mocked<BusinessMetricsService>;
  let sharesMetrics: jest.Mocked<SharesMetricsService>;

  // Mock business metrics data
  const mockBusinessMetrics = {
    userEngagement: {
      dailyActiveUsers: 250,
      monthlyActiveUsers: 1500,
      newUserRegistrations: 15,
      dau_mau_ratio: 16.67,
    },
    sessions: {
      total: 500,
      averageDuration: 1200,
      byDevice: { mobile: 300, desktop: 150, tablet: 50 },
      byVersion: { '1.0.0': 200, '1.1.0': 300 },
    },
    featureUsage: {
      wallet: {
        usageCount: 100,
        successCount: 95,
        failureCount: 5,
        totalDuration: 5000,
        averageDuration: 50,
      },
      shares: {
        usageCount: 80,
        successCount: 78,
        failureCount: 2,
        totalDuration: 4000,
        averageDuration: 50,
      },
    },
    retention: {
      day1: 85,
      day7: 70,
      day30: 45,
      day90: 25,
    },
  };

  // Mock shares metrics data
  const mockSharesMetrics = {
    totalSubscriptions: 150,
    successfulSubscriptions: 145,
    failedSubscriptions: 5,
    totalTransfers: 50,
    successfulTransfers: 48,
    failedTransfers: 2,
    totalSharesSubscribed: 1500,
    totalSharesTransferred: 300,
    subscriptionSuccessRate: 96.67,
    transferSuccessRate: 96,
    averageDurationSubscription: 1200,
    averageDurationTransfer: 800,
    errorTypes: {
      insufficientFunds: 3,
      validationError: 2,
    },
    userReachingLimits: 5,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: BusinessMetricsService,
          useValue: {
            getBusinessMetrics: jest.fn().mockReturnValue(mockBusinessMetrics),
          },
        },
        {
          provide: SharesMetricsService,
          useValue: {
            getMetrics: jest.fn().mockReturnValue(mockSharesMetrics),
          },
        },
        {
          provide: ChamaMetricsService,
          useValue: {},
        },
        {
          provide: TransactionMetricsService,
          useValue: {},
        },
        {
          provide: SwapMetricsService,
          useValue: {},
        },
        {
          provide: PersonalMetricsService,
          useValue: {},
        },
        {
          provide: NotificationMetrics,
          useValue: {},
        },
        {
          provide: NostrMetricsService,
          useValue: {},
        },
        {
          provide: LnurlMetricsService,
          useValue: {},
        },
        {
          provide: AuthMetricsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    businessMetrics = module.get(BusinessMetricsService);
    sharesMetrics = module.get(SharesMetricsService);

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverviewMetrics', () => {
    it('should return dashboard overview metrics', async () => {
      const result = await service.getOverviewMetrics();

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalMembers).toBe(
        mockBusinessMetrics.userEngagement.monthlyActiveUsers,
      );
      expect(result.summary.activeMembersToday).toBe(
        mockBusinessMetrics.userEngagement.dailyActiveUsers,
      );
      expect(result.trends).toBeDefined();
      expect(result.alerts).toBeDefined();
      expect(result.quickStats).toBeDefined();
    });

    it('should include proper summary data', async () => {
      const result = await service.getOverviewMetrics();

      expect(result.summary.totalMembers).toBe(1500);
      expect(result.summary.activeMembersToday).toBe(250);
      expect(result.summary.totalVolume.currency).toBe('KES');
      expect(result.summary.totalVolume.period).toBe('all-time');
    });

    it('should include quick stats', async () => {
      const result = await service.getOverviewMetrics();

      expect(result.quickStats.newMembersToday).toBe(15);
      expect(result.quickStats.activeSessionsNow).toBe(500);
    });

    it('should handle errors gracefully', async () => {
      businessMetrics.getBusinessMetrics.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      await expect(service.getOverviewMetrics()).rejects.toThrow(
        'Service unavailable',
      );
    });
  });

  describe('getUserAnalytics', () => {
    it('should return user analytics data', async () => {
      const result = await service.getUserAnalytics();

      expect(result).toBeDefined();
      expect(result.engagement).toBeDefined();
      expect(result.retention).toBeDefined();
      expect(result.demographics).toBeDefined();
      expect(result.featureUsage).toBeDefined();
      expect(result.membershipActivity).toBeDefined();
    });

    it('should include engagement metrics', async () => {
      const result = await service.getUserAnalytics();

      expect(result.engagement.dailyActiveUsers).toBe(250);
      expect(result.engagement.monthlyActiveUsers).toBe(1500);
      expect(result.engagement.dau_mau_ratio).toBe(16.67);
      expect(result.engagement.sessionMetrics.averageDuration).toBe(1200);
    });

    it('should include retention metrics', async () => {
      const result = await service.getUserAnalytics();

      expect(result.retention.day1).toBe(85);
      expect(result.retention.day7).toBe(70);
      expect(result.retention.day30).toBe(45);
      expect(result.retention.day90).toBe(25);
    });

    it('should include device demographics', async () => {
      const result = await service.getUserAnalytics();

      expect(result.demographics.byDeviceType).toEqual({
        mobile: 300,
        desktop: 150,
        tablet: 50,
      });
    });

    it('should format feature usage correctly', async () => {
      const result = await service.getUserAnalytics();

      expect(result.featureUsage.topFeatures).toHaveLength(2);
      expect(result.featureUsage.topFeatures[0]).toMatchObject({
        featureId: 'wallet',
        featureName: 'Wallet',
        usageCount: 100,
        successRate: 95,
      });
    });

    it('should handle errors gracefully', async () => {
      businessMetrics.getBusinessMetrics.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      await expect(service.getUserAnalytics()).rejects.toThrow(
        'Service unavailable',
      );
    });
  });

  describe('getFinancialAnalytics', () => {
    it('should return financial analytics data', async () => {
      const result = await service.getFinancialAnalytics();

      expect(result).toBeDefined();
      expect(result.transactions).toBeDefined();
      expect(result.swaps).toBeDefined();
      expect(result.chamas).toBeDefined();
      expect(result.shares).toBeDefined();
    });

    it('should include shares ownership data', async () => {
      const result = await service.getFinancialAnalytics();

      expect(result.shares.ownership.distributedShares).toBe(1500);
      expect(result.shares.trading.totalTransfers).toBe(50);
      expect(result.shares.trading.transferVolume).toBe(300);
    });

    it('should calculate average transfer size correctly', async () => {
      const result = await service.getFinancialAnalytics();

      expect(result.shares.trading.averageTransferSize).toBe(6); // 300 / 50
    });

    it('should handle zero transfers correctly', async () => {
      sharesMetrics.getMetrics.mockReturnValue({
        ...mockSharesMetrics,
        totalTransfers: 0,
        totalSharesTransferred: 0,
      });

      const result = await service.getFinancialAnalytics();

      expect(result.shares.trading.averageTransferSize).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      sharesMetrics.getMetrics.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      await expect(service.getFinancialAnalytics()).rejects.toThrow(
        'Service unavailable',
      );
    });
  });

  describe('getOperationalMetrics', () => {
    it('should return operational metrics data', async () => {
      const result = await service.getOperationalMetrics();

      expect(result).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.resources).toBeDefined();
      expect(result.infrastructure).toBeDefined();
    });

    it('should include system health data', async () => {
      const result = await service.getOperationalMetrics();

      expect(result.system.health.status).toBe('healthy');
      expect(result.system.health.uptime).toBeGreaterThan(0);
      expect(result.system.health.version).toBeDefined();
    });

    it('should include performance metrics', async () => {
      const result = await service.getOperationalMetrics();

      expect(result.system.performance.responseTime.average).toBe(150);
      expect(result.system.performance.throughput.requestsPerSecond).toBe(10);
      expect(result.system.performance.errors.errorRate).toBe(0.5);
    });

    it('should include resource utilization', async () => {
      const result = await service.getOperationalMetrics();

      expect(result.resources.server.cpuUsage).toBeGreaterThan(0);
      expect(result.resources.server.memoryUsage).toBeGreaterThan(0);
      expect(result.resources.cache.hitRate).toBeGreaterThan(0);
    });
  });

  describe('getLiveMetrics', () => {
    it('should return live metrics update', async () => {
      const result = await service.getLiveMetrics();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.type).toBe('metrics-update');
    });

    it('should include current active users', async () => {
      const result = await service.getLiveMetrics();

      expect(result.metrics.activeUsers).toBe(250);
    });

    it('should include system load metrics', async () => {
      const result = await service.getLiveMetrics();

      expect(result.metrics.systemLoad).toBeGreaterThan(0);
      expect(result.metrics.errorRate).toBe(0.5);
      expect(result.metrics.responseTime).toBe(150);
    });

    it('should handle errors gracefully', async () => {
      businessMetrics.getBusinessMetrics.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      await expect(service.getLiveMetrics()).rejects.toThrow(
        'Service unavailable',
      );
    });
  });

  describe('Helper methods', () => {
    it('should format feature usage correctly', () => {
      const service = new DashboardService(
        businessMetrics,
        sharesMetrics,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      // Access private method through type assertion
      const formatFeatureUsage = (service as any).formatFeatureUsage;
      const result = formatFeatureUsage(mockBusinessMetrics.featureUsage);

      expect(result).toHaveLength(2);
      expect(result[0].featureName).toBe('Wallet');
      expect(result[1].featureName).toBe('Shares');
    });

    it('should calculate feature success rates correctly', () => {
      const service = new DashboardService(
        businessMetrics,
        sharesMetrics,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      // Access private method through type assertion
      const calculateFeatureSuccessRates = (service as any)
        .calculateFeatureSuccessRates;
      const result = calculateFeatureSuccessRates(
        mockBusinessMetrics.featureUsage,
      );

      expect(result.wallet).toBe(95);
      expect(result.shares).toBe(97.5);
    });

    it('should handle empty feature usage data', () => {
      const service = new DashboardService(
        businessMetrics,
        sharesMetrics,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      // Access private method through type assertion
      const formatFeatureUsage = (service as any).formatFeatureUsage;
      const result = formatFeatureUsage({});

      expect(result).toEqual([]);
    });
  });
});
