import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/auth/jwt.auth';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: jest.Mocked<DashboardService>;

  // Mock dashboard data
  const mockOverviewData = {
    summary: {
      totalMembers: 1500,
      activeMembersToday: 250,
      activeChamas: 45,
      totalChamas: 52,
      totalVolume: {
        amount: 10000000,
        currency: 'KES' as const,
        period: 'all-time' as const,
      },
      transactionCount: {
        total: 2500,
        successful: 2450,
        failed: 45,
        pending: 5,
      },
    },
    trends: {
      memberGrowth: [],
      volumeTrend: [],
      transactionTrend: [],
      chamaGrowth: [],
    },
    alerts: {
      systemHealth: 'healthy' as const,
      errorRate: 0.5,
      avgResponseTime: 150,
      criticalAlerts: [],
    },
    quickStats: {
      todayTransactions: 25,
      todayVolume: 50000,
      activeSessionsNow: 500,
      newMembersToday: 15,
    },
  };

  const mockUserAnalytics = {
    engagement: {
      dailyActiveUsers: 250,
      monthlyActiveUsers: 1500,
      weeklyActiveUsers: 1750,
      dau_mau_ratio: 16.67,
      sessionMetrics: {
        averageDuration: 1200,
        totalSessions: 500,
        sessionsToday: 25,
        peakConcurrentUsers: 250,
      },
    },
    retention: {
      day1: 85,
      day7: 70,
      day30: 45,
      day90: 25,
      cohortData: [],
    },
    demographics: {
      byRegion: {},
      byDeviceType: { mobile: 300, desktop: 150, tablet: 50 },
      byAppVersion: { '1.0.0': 200, '1.1.0': 300 },
      registrationTrend: [],
    },
    featureUsage: {
      topFeatures: [],
      adoption: [],
      successRates: {},
    },
    membershipActivity: {
      newRegistrations: {
        today: 15,
        thisWeek: 105,
        thisMonth: 450,
      },
      chamaParticipation: {
        activeMembersInChamas: 0,
        averageChamasPerMember: 0,
        chamaMembershipTrend: [],
      },
    },
  };

  const mockFinancialAnalytics = {
    transactions: {
      volume: {
        total: 10000000,
        today: 50000,
        thisWeek: 350000,
        thisMonth: 1500000,
        byCurrency: {},
        byOperation: {},
        trend: [],
      },
      counts: {
        total: 2500,
        successful: 2450,
        failed: 45,
        pending: 5,
        averagePerDay: 50,
      },
      performance: {
        averageDuration: 250,
        successRate: 98,
        errorsByType: {},
        durationTrend: [],
      },
    },
    swaps: {
      onramp: {
        count: 150,
        successful: 145,
        successRate: 96.7,
        totalKes: 2000000,
        totalSats: 500000000,
        averageAmount: 13333,
        trend: [],
        byPaymentMethod: {},
      },
      offramp: {
        count: 80,
        successful: 78,
        successRate: 97.5,
        totalKes: 1000000,
        totalSats: 250000000,
        averageAmount: 12500,
        trend: [],
        byPaymentMethod: {},
      },
      fxRates: {
        current: {
          buyRate: 4000,
          sellRate: 3950,
          spread: 1.25,
          lastUpdated: new Date().toISOString(),
        },
        history: [],
      },
      volume: {
        totalOnrampKes: 2000000,
        totalOfframpKes: 1000000,
        totalOnrampSats: 500000000,
        totalOfframpSats: 250000000,
      },
    },
    chamas: {
      financial: {
        totalBalance: 5000000,
        totalDeposits: 8000000,
        totalWithdrawals: 3000000,
        netFlow: 5000000,
      },
      distribution: {
        balanceDistribution: [],
        memberBalanceDistribution: [],
        depositPatterns: [],
      },
      activity: {
        depositsToday: 0,
        withdrawalsToday: 0,
        pendingWithdrawals: 0,
        averageBalance: 0,
      },
    },
    shares: {
      ownership: {
        totalShares: 1800,
        distributedShares: 1500,
        availableShares: 998500,
        ownershipConcentration: 0,
      },
      trading: {
        totalTransfers: 50,
        transferVolume: 300,
        averageTransferSize: 6,
        transferTrend: [],
      },
    },
  };

  const mockOperationalMetrics = {
    system: {
      health: {
        status: 'healthy' as const,
        uptime: 86400,
        lastRestart: new Date().toISOString(),
        version: '1.0.0',
      },
      performance: {
        responseTime: {
          average: 150,
          p50: 120,
          p95: 300,
          p99: 500,
          trend: [],
        },
        throughput: {
          requestsPerSecond: 10,
          requestsPerMinute: 600,
          peakRps: 25,
          trend: [],
        },
        errors: {
          errorRate: 0.5,
          totalErrors: 0,
          errorsByType: {},
          errorsByEndpoint: {},
          trend: [],
        },
      },
    },
    services: {},
    resources: {
      server: {
        cpuUsage: 35,
        memoryUsage: 65,
        diskUsage: 70,
        networkActivity: {
          bytesIn: 500000,
          bytesOut: 750000,
          connectionsActive: 125,
        },
      },
      database: {
        connectionPool: {
          active: 5,
          idle: 10,
          waiting: 0,
          maxConnections: 20,
        },
        performance: {
          queryTime: 25,
          slowQueries: 0,
          deadlocks: 0,
        },
      },
      cache: {
        hitRate: 85.5,
        memoryUsage: 128,
        evictions: 0,
        keyCount: 1500,
      },
    },
    infrastructure: {
      loadBalancer: {
        activeServers: 1,
        totalServers: 1,
        requestDistribution: {},
      },
      monitoring: {
        alertsActive: 0,
        alertsResolved: 5,
        monitoringCoverage: 90,
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getOverviewMetrics: jest.fn().mockResolvedValue(mockOverviewData),
            getUserAnalytics: jest.fn().mockResolvedValue(mockUserAnalytics),
            getFinancialAnalytics: jest
              .fn()
              .mockResolvedValue(mockFinancialAnalytics),
            getOperationalMetrics: jest
              .fn()
              .mockResolvedValue(mockOperationalMetrics),
            getLiveMetrics: jest.fn().mockResolvedValue({
              timestamp: new Date().toISOString(),
              metrics: {
                activeUsers: 250,
                transactionsInProgress: 5,
                systemLoad: 35,
                errorRate: 0.5,
                responseTime: 150,
              },
              type: 'metrics-update',
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    dashboardService = module.get(DashboardService);

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return overview metrics successfully', async () => {
      const result = await controller.getOverview();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOverviewData);
      expect(result.message).toBe('Dashboard overview retrieved successfully');
      expect(result.timestamp).toBeDefined();
      expect(result.meta?.dataSource).toBe('realtime');
      expect(dashboardService.getOverviewMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
      const errorMessage = 'Service unavailable';
      dashboardService.getOverviewMetrics.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await controller.getOverview();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to retrieve dashboard overview');
      expect(result.errors).toEqual([errorMessage]);
    });

    it('should include proper metadata', async () => {
      const result = await controller.getOverview();

      expect(result.meta?.cached).toBe(false);
      expect(result.meta?.cacheAge).toBe(0);
      expect(result.meta?.dataSource).toBe('realtime');
    });
  });

  describe('getUserAnalytics', () => {
    it('should return user analytics successfully', async () => {
      const result = await controller.getUserAnalytics();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUserAnalytics);
      expect(result.message).toBe('User analytics retrieved successfully');
      expect(result.meta?.dataSource).toBe('aggregated');
      expect(dashboardService.getUserAnalytics).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
      const errorMessage = 'Analytics service down';
      dashboardService.getUserAnalytics.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await controller.getUserAnalytics();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to retrieve user analytics');
      expect(result.errors).toEqual([errorMessage]);
    });
  });

  describe('getFinancialAnalytics', () => {
    it('should return financial analytics successfully', async () => {
      const result = await controller.getFinancialAnalytics();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockFinancialAnalytics);
      expect(result.message).toBe('Financial analytics retrieved successfully');
      expect(result.meta?.dataSource).toBe('aggregated');
      expect(dashboardService.getFinancialAnalytics).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
      const errorMessage = 'Financial data unavailable';
      dashboardService.getFinancialAnalytics.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await controller.getFinancialAnalytics();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to retrieve financial analytics');
      expect(result.errors).toEqual([errorMessage]);
    });
  });

  describe('getOperationalMetrics', () => {
    it('should return operational metrics successfully', async () => {
      const result = await controller.getOperationalMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOperationalMetrics);
      expect(result.message).toBe('Operational metrics retrieved successfully');
      expect(result.meta?.dataSource).toBe('realtime');
      expect(dashboardService.getOperationalMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
      const errorMessage = 'System metrics unavailable';
      dashboardService.getOperationalMetrics.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await controller.getOperationalMetrics();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to retrieve operational metrics');
      expect(result.errors).toEqual([errorMessage]);
    });
  });

  describe('getCustomAnalytics', () => {
    it('should return custom analytics successfully', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const metrics = 'users,transactions';
      const granularity = 'day';

      const result = await controller.getCustomAnalytics(
        startDate,
        endDate,
        metrics,
        granularity,
      );

      expect(result.success).toBe(true);
      expect(result.data.dateRange.start).toBe(startDate);
      expect(result.data.dateRange.end).toBe(endDate);
      expect(result.data.dateRange.granularity).toBe(granularity);
      expect(result.message).toBe('Custom analytics retrieved successfully');
    });

    it('should use default granularity when not provided', async () => {
      const result = await controller.getCustomAnalytics(
        '2024-01-01',
        '2024-01-31',
        'users',
      );

      expect(result.data.dateRange.granularity).toBe('day');
    });
  });

  describe('exportDashboardData', () => {
    it('should submit export request successfully', async () => {
      const exportRequest = {
        format: 'csv' as const,
        dataType: 'overview' as const,
        includeCharts: false,
      };

      const result = await controller.exportDashboardData(exportRequest);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('processing');
      expect(result.data.exportId).toBeDefined();
      expect(result.data.estimatedCompletion).toBeDefined();
      expect(result.message).toBe('Export request submitted successfully');
    });

    it('should handle export request errors gracefully', async () => {
      // Force an error by providing invalid data
      const invalidRequest = null as any;

      const result = await controller.exportDashboardData(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to submit export request');
      expect(result.errors).toBeDefined();
    });
  });

  describe('getExportStatus', () => {
    it('should return export status successfully', async () => {
      const exportId = 'test-export-123';

      const result = await controller.getExportStatus(exportId);

      expect(result.success).toBe(true);
      expect(result.data.exportId).toBe(exportId);
      expect(result.data.status).toBe('completed');
      expect(result.data.progress).toBe(100);
      expect(result.data.downloadUrl).toBeDefined();
      expect(result.message).toBe('Export status retrieved successfully');
    });
  });

  describe('downloadExport', () => {
    it('should handle download request', async () => {
      const mockResponse = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.downloadExport('test-export-123', mockResponse);

      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/json',
        'Content-Disposition':
          'attachment; filename="dashboard-export-test-export-123.json"',
        'Content-Length': expect.any(String),
      });
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should handle download errors gracefully', async () => {
      const mockResponse = {
        set: jest.fn().mockImplementation(() => {
          throw new Error('Response error');
        }),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.downloadExport('test-export-123', mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to download export',
        errors: ['Response error'],
        timestamp: expect.any(String),
      });
    });
  });

  describe('Error handling', () => {
    it('should format error responses consistently', async () => {
      dashboardService.getOverviewMetrics.mockRejectedValue(
        new Error('Test error'),
      );

      const result = await controller.getOverview();

      expect(result).toMatchObject({
        success: false,
        message: expect.any(String),
        errors: ['Test error'],
        timestamp: expect.any(String),
      });
    });
  });

  describe('Response format consistency', () => {
    it('should return consistent response format for all endpoints', async () => {
      const overviewResult = await controller.getOverview();
      const userResult = await controller.getUserAnalytics();
      const financialResult = await controller.getFinancialAnalytics();
      const operationalResult = await controller.getOperationalMetrics();

      // Check that all responses have the same structure
      [overviewResult, userResult, financialResult, operationalResult].forEach(
        (result) => {
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('message');
          expect(result).toHaveProperty('timestamp');
          expect(result).toHaveProperty('meta');
        },
      );
    });
  });
});
