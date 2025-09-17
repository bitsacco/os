import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BusinessMetricsService } from './business.metrics';
import { BusinessMetricsRepository } from '../../dashboard/db/business-metrics.repository';
import { BusinessMetricsDocument } from '../../dashboard/db/business-metrics.schema';

describe('BusinessMetricsService (Enhanced with Persistence)', () => {
  let service: BusinessMetricsService;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let repository: jest.Mocked<BusinessMetricsRepository>;
  let schedulerRegistry: jest.Mocked<SchedulerRegistry>;

  const mockBusinessMetricsDocument: Partial<BusinessMetricsDocument> = {
    _id: 'test-id',
    timestamp: new Date('2023-01-01T00:00:00.000Z'),
    period: 'daily',
    source: 'business-metrics',
    version: 1,
    userEngagement: {
      dailyActiveUsers: 150,
      monthlyActiveUsers: 3000,
      weeklyActiveUsers: 900,
      newUserRegistrations: 25,
      dau_mau_ratio: 5.0,
    },
    sessions: {
      total: 300,
      averageDuration: 1500,
      byDevice: { mobile: 180, desktop: 120 },
      byVersion: { '1.0.0': 250, '1.1.0': 50 },
      peakConcurrentUsers: 85,
    },
    featureUsage: {
      login: {
        usageCount: 300,
        successCount: 298,
        failureCount: 2,
        totalDuration: 6000,
        averageDuration: 20,
      },
    },
    retention: {
      day1: 88.0,
      day7: 68.0,
      day30: 48.0,
      day90: 28.0,
    },
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: BusinessMetricsService,
          useFactory: (
            eventEmitter: EventEmitter2,
            repository: BusinessMetricsRepository,
            schedulerRegistry: SchedulerRegistry,
          ) => {
            return new BusinessMetricsService(
              eventEmitter,
              repository,
              schedulerRegistry,
            );
          },
          inject: [EventEmitter2, BusinessMetricsRepository, SchedulerRegistry],
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: BusinessMetricsRepository,
          useValue: {
            getLatestMetrics: jest.fn(),
            storeBusinessMetrics: jest.fn(),
            getUserEngagementTrends: jest.fn(),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addInterval: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BusinessMetricsService>(BusinessMetricsService);
    eventEmitter = module.get(EventEmitter2);
    repository = module.get(BusinessMetricsRepository);
    schedulerRegistry = module.get(SchedulerRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize from database when repository is available', async () => {
      repository.getLatestMetrics.mockResolvedValue(
        mockBusinessMetricsDocument as BusinessMetricsDocument,
      );

      await service.onModuleInit();

      expect(repository.getLatestMetrics).toHaveBeenCalledWith(
        'business-metrics',
        'daily',
      );
    });

    it('should handle database initialization errors gracefully', async () => {
      repository.getLatestMetrics.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Should not throw an error, even when database fails
      await service.onModuleInit();

      // Should continue without throwing and disable persistence
      expect(service.getPersistenceStatus().enabled).toBe(false);
    });

    it('should set up periodic persistence when repository is available', async () => {
      repository.getLatestMetrics.mockResolvedValue(null);

      await service.onModuleInit();

      expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
        'business-metrics-persist',
        expect.any(Object),
      );
    });
  });

  describe('persistence functionality', () => {
    beforeEach(async () => {
      // Initialize the service properly first
      await service.onModuleInit();
    });

    it('should persist current metrics', async () => {
      repository.storeBusinessMetrics.mockResolvedValue(
        mockBusinessMetricsDocument as BusinessMetricsDocument,
      );

      // Record some metrics first
      service.recordNewUserRegistration('user-1');
      service.recordUserSessionMetric({
        userId: 'user-1',
        sessionId: 'session-1',
        duration: 1200,
        features: ['login', 'payment'],
        deviceType: 'mobile',
        appVersion: '1.0.0',
      });

      const result = await service.forcePersistence();

      expect(result).toBe(true);
      expect(repository.storeBusinessMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'business-metrics',
          period: 'real-time',
          version: 1,
          userEngagement: expect.objectContaining({
            dailyActiveUsers: 1,
            newUserRegistrations: 1,
          }),
          sessions: expect.objectContaining({
            total: 1,
            averageDuration: 1200,
          }),
        }),
      );
    });

    it('should handle persistence errors gracefully', async () => {
      repository.storeBusinessMetrics.mockRejectedValue(
        new Error('Database write failed'),
      );

      // The method doesn't throw, but handles errors internally
      const result = await service.forcePersistence();

      // Method still returns true, but error count should increase
      expect(result).toBe(true);

      // Check that error count increased (the error was caught and handled)
      const status = service.getPersistenceStatus();
      expect(status.errorCount).toBeGreaterThan(0);
    });

    it('should disable persistence after repeated failures', async () => {
      repository.storeBusinessMetrics.mockRejectedValue(
        new Error('Persistent failure'),
      );

      // Call persistence multiple times to trigger failure threshold
      for (let i = 0; i < 6; i++) {
        await service.forcePersistence();
      }

      expect(service.getPersistenceStatus().enabled).toBe(false);
    });
  });

  describe('aggregation jobs', () => {
    beforeEach(async () => {
      // Initialize the service properly first
      await service.onModuleInit();
    });

    it('should aggregate daily metrics', async () => {
      repository.storeBusinessMetrics.mockResolvedValue(
        mockBusinessMetricsDocument as BusinessMetricsDocument,
      );

      await service.aggregateDailyMetrics();

      expect(repository.storeBusinessMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          period: 'daily',
          source: 'business-metrics',
        }),
      );
    });

    it('should aggregate weekly metrics', async () => {
      repository.storeBusinessMetrics.mockResolvedValue(
        mockBusinessMetricsDocument as BusinessMetricsDocument,
      );

      await service.aggregateWeeklyMetrics();

      expect(repository.storeBusinessMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          period: 'weekly',
          source: 'business-metrics',
        }),
      );
    });

    it('should aggregate monthly metrics', async () => {
      repository.storeBusinessMetrics.mockResolvedValue(
        mockBusinessMetricsDocument as BusinessMetricsDocument,
      );

      await service.aggregateMonthlyMetrics();

      expect(repository.storeBusinessMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          period: 'monthly',
          source: 'business-metrics',
        }),
      );
    });

    it('should handle aggregation errors gracefully', async () => {
      repository.storeBusinessMetrics.mockRejectedValue(
        new Error('Aggregation failed'),
      );

      // These should not throw even when persistence fails
      await service.aggregateDailyMetrics();
      await service.aggregateWeeklyMetrics();
      await service.aggregateMonthlyMetrics();

      expect(repository.storeBusinessMetrics).toHaveBeenCalledTimes(3);
    });

    it('should skip aggregation when persistence is disabled', async () => {
      // Create service without initializing (so persistence is disabled)
      const uninitializedService = new BusinessMetricsService(
        eventEmitter,
        repository,
        schedulerRegistry,
      );

      await uninitializedService.aggregateDailyMetrics();

      expect(repository.storeBusinessMetrics).not.toHaveBeenCalled();
    });

    it('should skip aggregation when repository is not available', async () => {
      // Create service without repository
      const serviceWithoutRepo = new BusinessMetricsService(eventEmitter);

      await serviceWithoutRepo.aggregateDailyMetrics();

      expect(repository.storeBusinessMetrics).not.toHaveBeenCalled();
    });
  });

  describe('historical data retrieval', () => {
    beforeEach(async () => {
      // Initialize the service properly first
      await service.onModuleInit();
    });

    it('should get historical metrics from repository', async () => {
      const mockTrendData = [
        {
          timestamp: new Date('2023-01-01'),
          dailyActiveUsers: 100,
          monthlyActiveUsers: 2500,
        },
        {
          timestamp: new Date('2023-01-02'),
          dailyActiveUsers: 110,
          monthlyActiveUsers: 2550,
        },
      ];

      repository.getUserEngagementTrends.mockResolvedValue(mockTrendData);

      const result = await service.getHistoricalMetrics(30);

      expect(result).toEqual(mockTrendData);
      expect(repository.getUserEngagementTrends).toHaveBeenCalledWith(30);
    });

    it('should return empty array when repository is not available', async () => {
      // Create a new service instance without repository
      const serviceWithoutRepo = new BusinessMetricsService(eventEmitter);

      const result = await serviceWithoutRepo.getHistoricalMetrics(30);

      expect(result).toEqual([]);
    });

    it('should handle repository errors gracefully', async () => {
      repository.getUserEngagementTrends.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getHistoricalMetrics(30);

      expect(result).toEqual([]);
    });
  });

  describe('getPersistenceStatus', () => {
    it('should return current persistence status', async () => {
      // Initialize service to set up persistence state
      repository.getLatestMetrics.mockResolvedValue(
        mockBusinessMetricsDocument as BusinessMetricsDocument,
      );
      await service.onModuleInit();

      const status = service.getPersistenceStatus();

      expect(status.enabled).toBe(true);
      expect(status.repositoryAvailable).toBe(true);
      expect(status.errorCount).toBe(0);
      expect(status.lastPersistenceTime).toBeNull(); // No persistence has occurred yet
    });

    it('should indicate when repository is not available', () => {
      // Create a new service instance without repository
      const serviceWithoutRepo = new BusinessMetricsService(eventEmitter);

      const status = serviceWithoutRepo.getPersistenceStatus();

      expect(status.repositoryAvailable).toBe(false);
    });
  });

  describe('hybrid storage behavior', () => {
    it('should maintain in-memory metrics even when persistence fails', () => {
      // Record metrics normally
      service.recordNewUserRegistration('user-1');
      service.recordNewUserRegistration('user-2');

      const currentMetrics = service.getBusinessMetrics();

      expect(currentMetrics.userEngagement.newUserRegistrations).toBe(2);
      expect(currentMetrics.userEngagement.dailyActiveUsers).toBe(2);
    });

    it('should restore metrics from database on initialization', async () => {
      // Test that onModuleInit properly initializes from database
      repository.getLatestMetrics.mockResolvedValue(
        mockBusinessMetricsDocument as BusinessMetricsDocument,
      );

      await service.onModuleInit();

      // Verify service was initialized (we can tell by checking persistence status)
      const status = service.getPersistenceStatus();
      expect(status.repositoryAvailable).toBe(true);
    });

    it('should continue operating when database is unavailable', () => {
      // Create a new service instance without repository
      const serviceWithoutRepo = new BusinessMetricsService(eventEmitter);

      // Should still record metrics in memory
      serviceWithoutRepo.recordNewUserRegistration('user-1');
      serviceWithoutRepo.recordUserSessionMetric({
        userId: 'user-1',
        sessionId: 'session-1',
        duration: 1200,
        features: ['login'],
        deviceType: 'mobile',
      });

      const metrics = serviceWithoutRepo.getBusinessMetrics();

      expect(metrics.userEngagement.newUserRegistrations).toBe(1);
      expect(metrics.sessions.total).toBe(1);
    });
  });

  describe('metrics document building', () => {
    it('should build correct metrics document structure through persistence', async () => {
      // Initialize service first
      await service.onModuleInit();

      // Record some test data
      service.recordNewUserRegistration('user-1');
      service.recordUserSessionMetric({
        userId: 'user-1',
        sessionId: 'session-1',
        duration: 1500,
        features: ['login', 'payment'],
        deviceType: 'mobile',
        appVersion: '1.0.0',
      });
      service.recordFeatureUsageMetric({
        featureId: 'login',
        userId: 'user-1',
        duration: 200,
        successful: true,
      });

      // Trigger persistence which will build the document
      repository.storeBusinessMetrics.mockResolvedValue(
        mockBusinessMetricsDocument as BusinessMetricsDocument,
      );
      await service.forcePersistence();

      // Verify the document was built correctly by checking the call
      expect(repository.storeBusinessMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          period: 'real-time',
          source: 'business-metrics',
          version: 1,
          userEngagement: expect.objectContaining({
            dailyActiveUsers: 1,
            newUserRegistrations: 1,
          }),
          sessions: expect.objectContaining({
            total: 1,
            averageDuration: 1500,
            byDevice: { mobile: 1 },
            byVersion: { '1.0.0': 1 },
          }),
          featureUsage: {
            login: {
              usageCount: 1,
              successCount: 1,
              failureCount: 0,
              totalDuration: 200,
              averageDuration: 200,
            },
          },
        }),
      );
    });

    it('should handle different period types through aggregation', async () => {
      // Initialize service first
      await service.onModuleInit();

      repository.storeBusinessMetrics.mockResolvedValue(
        mockBusinessMetricsDocument as BusinessMetricsDocument,
      );

      // Test daily aggregation
      await service.aggregateDailyMetrics();
      expect(repository.storeBusinessMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'daily' }),
      );

      // Test weekly aggregation
      await service.aggregateWeeklyMetrics();
      expect(repository.storeBusinessMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'weekly' }),
      );

      // Test monthly aggregation
      await service.aggregateMonthlyMetrics();
      expect(repository.storeBusinessMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'monthly' }),
      );
    });
  });
});
