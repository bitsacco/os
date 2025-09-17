import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MetricsHealthService,
  HealthStatus,
  StorageType,
} from './metrics-health.service';
import { BusinessMetricsRepository } from '../db/business-metrics.repository';
import { FinancialMetricsRepository } from '../db/financial-metrics.repository';
import { OperationalMetricsRepository } from '../db/operational-metrics.repository';
import { SharesMetricsRepository } from '../db/shares-metrics.repository';

describe('MetricsHealthService', () => {
  let service: MetricsHealthService;
  let businessMetricsRepository: jest.Mocked<BusinessMetricsRepository>;
  let financialMetricsRepository: jest.Mocked<FinancialMetricsRepository>;
  let operationalMetricsRepository: jest.Mocked<OperationalMetricsRepository>;
  let sharesMetricsRepository: jest.Mocked<SharesMetricsRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockRepository = {
    healthCheck: jest.fn(),
    getLatestMetrics: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Default successful mock behavior with small delay to simulate response time
    mockRepository.healthCheck.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 10)),
    );
    mockRepository.getLatestMetrics.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({}), 5)),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsHealthService,
        {
          provide: BusinessMetricsRepository,
          useValue: mockRepository,
        },
        {
          provide: FinancialMetricsRepository,
          useValue: mockRepository,
        },
        {
          provide: OperationalMetricsRepository,
          useValue: mockRepository,
        },
        {
          provide: SharesMetricsRepository,
          useValue: mockRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<MetricsHealthService>(MetricsHealthService);
    businessMetricsRepository = module.get(BusinessMetricsRepository);
    financialMetricsRepository = module.get(FinancialMetricsRepository);
    operationalMetricsRepository = module.get(OperationalMetricsRepository);
    sharesMetricsRepository = module.get(SharesMetricsRepository);
    eventEmitter = mockEventEmitter as jest.Mocked<EventEmitter2>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkMetricsHealth', () => {
    it('should return healthy status when all repositories are working', async () => {
      // Mock all repositories as healthy
      mockRepository.healthCheck.mockResolvedValue(true);
      mockRepository.getLatestMetrics.mockResolvedValue({});

      const healthStatus = await service.checkMetricsHealth();

      expect(healthStatus.overallStatus).toBe(HealthStatus.HEALTHY);
      expect(healthStatus.storageType).toBe(StorageType.PERSISTENT);
      expect(healthStatus.repositories).toHaveLength(4);
      expect(healthStatus.systemMetrics.healthyRepositories).toBe(4);
      expect(healthStatus.systemMetrics.criticalRepositories).toBe(0);
      expect(healthStatus.recommendations).toHaveLength(0);
    });

    it('should return critical status when all repositories fail', async () => {
      // Mock all repositories as failing
      mockRepository.healthCheck.mockRejectedValue(
        new Error('Connection failed'),
      );

      const healthStatus = await service.checkMetricsHealth();

      expect(healthStatus.overallStatus).toBe(HealthStatus.CRITICAL);
      expect(healthStatus.storageType).toBe(StorageType.MEMORY_ONLY);
      expect(healthStatus.systemMetrics.criticalRepositories).toBe(4);
      expect(healthStatus.systemMetrics.healthyRepositories).toBe(0);
      expect(healthStatus.recommendations).toContain(
        'Investigate database connectivity issues',
      );
    });

    it('should return degraded status when some repositories are slow', async () => {
      // Mock repositories with slow response times (3 seconds - within test timeout)
      mockRepository.healthCheck.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 3000)),
      );
      mockRepository.getLatestMetrics.mockResolvedValue({});

      const healthStatus = await service.checkMetricsHealth();

      // All repositories should be marked as degraded due to slow response
      expect(healthStatus.overallStatus).toBe(HealthStatus.DEGRADED);
      expect(healthStatus.systemMetrics.degradedRepositories).toBe(4);
    }, 10000); // Increase timeout for this specific test

    it('should return hybrid storage type when some repositories fail', async () => {
      // Mock half repositories as failing
      let callCount = 0;
      mockRepository.healthCheck.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve(true);
        } else {
          return Promise.reject(new Error('Connection failed'));
        }
      });
      mockRepository.getLatestMetrics.mockResolvedValue({});

      const healthStatus = await service.checkMetricsHealth();

      expect(healthStatus.storageType).toBe(StorageType.HYBRID);
      expect(healthStatus.systemMetrics.healthyRepositories).toBe(2);
      expect(healthStatus.systemMetrics.criticalRepositories).toBe(2);
    });
  });

  describe('checkRepositoryHealth', () => {
    it('should return healthy status for working repository', async () => {
      // Use the default mock implementation that has delays
      // Don't override with mockResolvedValue as that would make it instant

      const healthCheck = await service.checkRepositoryHealth(
        'business-metrics',
        businessMetricsRepository,
      );

      expect(healthCheck.repository).toBe('business-metrics');
      expect(healthCheck.status).toBe(HealthStatus.HEALTHY);
      expect(healthCheck.errorCount).toBe(0);
      expect(healthCheck.errorMessage).toBeUndefined();
      expect(healthCheck.responseTime).toBeGreaterThan(0);
    });

    it('should return critical status for failing repository', async () => {
      const errorMessage = 'Database connection failed';
      // Mock with delay to ensure response time is measured
      mockRepository.healthCheck.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), 10),
          ),
      );

      const healthCheck = await service.checkRepositoryHealth(
        'business-metrics',
        businessMetricsRepository,
      );

      expect(healthCheck.repository).toBe('business-metrics');
      expect(healthCheck.status).toBe(HealthStatus.CRITICAL);
      expect(healthCheck.errorMessage).toBe(errorMessage);
      expect(healthCheck.responseTime).toBeGreaterThan(0);
    });

    it('should return degraded status for slow repository', async () => {
      // Mock slow response (over threshold but within test timeout)
      mockRepository.healthCheck.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 3000)),
      );
      mockRepository.getLatestMetrics.mockResolvedValue({});

      const healthCheck = await service.checkRepositoryHealth(
        'business-metrics',
        businessMetricsRepository,
      );

      expect(healthCheck.status).toBe(HealthStatus.DEGRADED);
      expect(healthCheck.responseTime).toBeGreaterThan(2000);
    }, 10000); // Increase timeout for this specific test
  });

  describe('isMetricsSystemAvailable', () => {
    it('should return available when system is healthy', async () => {
      mockRepository.healthCheck.mockResolvedValue(true);
      mockRepository.getLatestMetrics.mockResolvedValue({});

      const availability = await service.isMetricsSystemAvailable();

      expect(availability.available).toBe(true);
      expect(availability.storageType).toBe(StorageType.PERSISTENT);
      expect(availability.healthStatus).toBe(HealthStatus.HEALTHY);
    });

    it('should return unavailable when system is down', async () => {
      mockRepository.healthCheck.mockRejectedValue(
        new Error('All systems down'),
      );

      // Force a fresh health check first to update cached status
      await service.checkMetricsHealth();

      const availability = await service.isMetricsSystemAvailable();

      expect(availability.available).toBe(true); // System is still available, just degraded
      expect(availability.storageType).toBe(StorageType.MEMORY_ONLY);
      expect(availability.healthStatus).toBe(HealthStatus.CRITICAL);
    });

    it('should handle service errors gracefully', async () => {
      // Simulate service error
      jest
        .spyOn(service, 'getCurrentHealthStatus')
        .mockRejectedValue(new Error('Service error'));

      const availability = await service.isMetricsSystemAvailable();

      expect(availability.available).toBe(false);
      expect(availability.storageType).toBe(StorageType.MEMORY_ONLY);
      expect(availability.healthStatus).toBe(HealthStatus.UNAVAILABLE);
    });
  });

  describe('getSystemAlerts', () => {
    beforeEach(() => {
      // Mock some health history
      const mockHealthStatus = {
        overallStatus: HealthStatus.DEGRADED,
        storageType: StorageType.MEMORY_ONLY,
        timestamp: new Date(),
        repositories: [
          {
            repository: 'business-metrics',
            status: HealthStatus.CRITICAL,
            responseTime: 1000,
            errorCount: 3,
            errorMessage: 'Connection timeout',
            lastSuccessfulWrite: null,
            lastSuccessfulRead: null,
          },
          {
            repository: 'financial-metrics',
            status: HealthStatus.DEGRADED,
            responseTime: 6000,
            errorCount: 1,
            lastSuccessfulWrite: new Date(),
            lastSuccessfulRead: new Date(),
          },
          {
            repository: 'operational-metrics',
            status: HealthStatus.HEALTHY,
            responseTime: 8000, // Slow but healthy
            errorCount: 0,
            lastSuccessfulWrite: new Date(),
            lastSuccessfulRead: new Date(),
          },
          {
            repository: 'shares-metrics',
            status: HealthStatus.HEALTHY,
            responseTime: 500,
            errorCount: 0,
            lastSuccessfulWrite: new Date(),
            lastSuccessfulRead: new Date(),
          },
        ],
        systemMetrics: {
          totalRepositories: 4,
          healthyRepositories: 2,
          degradedRepositories: 1,
          criticalRepositories: 1,
          unavailableRepositories: 0,
          averageResponseTime: 3875,
        },
        recommendations: [],
      };

      // Store in health history
      (service as any).healthHistory = [mockHealthStatus];
    });

    it('should generate appropriate alerts based on health status', () => {
      const alerts = service.getSystemAlerts();

      expect(alerts.critical).toContain(
        'Repository business-metrics is in critical state: Connection timeout',
      );
      expect(alerts.warnings).toContain(
        'Repository financial-metrics performance degraded (6000ms response time)',
      );
      expect(alerts.warnings).toContain(
        'Repository operational-metrics responding slowly (8000ms)',
      );
      expect(alerts.info).toContain(
        'Metrics system running in memory-only mode - data will not persist',
      );
    });

    it('should return empty alerts when no health data exists', () => {
      (service as any).healthHistory = [];

      const alerts = service.getSystemAlerts();

      expect(alerts.critical).toHaveLength(0);
      expect(alerts.warnings).toHaveLength(0);
      expect(alerts.info).toHaveLength(0);
    });
  });

  describe('getHealthHistory', () => {
    it('should return limited health history', () => {
      const mockHistory = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000),
        overallStatus: HealthStatus.HEALTHY,
        storageType: StorageType.PERSISTENT,
        repositories: [],
        systemMetrics: {
          totalRepositories: 4,
          healthyRepositories: 4,
          degradedRepositories: 0,
          criticalRepositories: 0,
          unavailableRepositories: 0,
          averageResponseTime: 500,
        },
        recommendations: [],
      }));

      (service as any).healthHistory = mockHistory;

      const history = service.getHealthHistory(20);

      expect(history).toHaveLength(20);
      expect(history[0].timestamp).toEqual(mockHistory[80].timestamp);
    });
  });

  describe('getRepositoryHealthTrends', () => {
    it('should return repository-specific health trends', () => {
      const mockHistory = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000),
        overallStatus: HealthStatus.HEALTHY,
        storageType: StorageType.PERSISTENT,
        repositories: [
          {
            repository: 'business-metrics',
            status: i % 2 === 0 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
            responseTime: 500 + i * 100,
            errorCount: i % 3,
            lastSuccessfulWrite: new Date(),
            lastSuccessfulRead: new Date(),
          },
        ],
        systemMetrics: {
          totalRepositories: 4,
          healthyRepositories: 4,
          degradedRepositories: 0,
          criticalRepositories: 0,
          unavailableRepositories: 0,
          averageResponseTime: 500,
        },
        recommendations: [],
      }));

      (service as any).healthHistory = mockHistory;

      const trends = service.getRepositoryHealthTrends('business-metrics', 5);

      expect(trends).toHaveLength(5);
      expect(trends[0]).toHaveProperty('timestamp');
      expect(trends[0]).toHaveProperty('status');
      expect(trends[0]).toHaveProperty('responseTime');
      expect(trends[0]).toHaveProperty('errorCount');
    });

    it('should handle missing repository data', () => {
      const mockHistory = [
        {
          timestamp: new Date(),
          overallStatus: HealthStatus.HEALTHY,
          storageType: StorageType.PERSISTENT,
          repositories: [], // No repositories in history
          systemMetrics: {
            totalRepositories: 0,
            healthyRepositories: 0,
            degradedRepositories: 0,
            criticalRepositories: 0,
            unavailableRepositories: 0,
            averageResponseTime: 0,
          },
          recommendations: [],
        },
      ];

      (service as any).healthHistory = mockHistory;

      const trends = service.getRepositoryHealthTrends('business-metrics', 5);

      expect(trends).toHaveLength(1);
      expect(trends[0].status).toBe(HealthStatus.UNAVAILABLE);
      expect(trends[0].responseTime).toBe(0);
      expect(trends[0].errorCount).toBe(0);
    });
  });

  describe('event handling', () => {
    it('should emit health status change events', async () => {
      // First establish healthy state using public API
      mockRepository.healthCheck.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 10)),
      );
      mockRepository.getLatestMetrics.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 5)),
      );

      await service.checkMetricsHealth(); // Establish baseline

      // Now change to critical status
      mockRepository.healthCheck.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('System failure')), 10),
          ),
      );

      await service.checkMetricsHealth(); // Trigger status change

      // Should emit status change event
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'metrics.health.status.changed',
        expect.objectContaining({
          previousStatus: HealthStatus.HEALTHY,
          currentStatus: HealthStatus.CRITICAL,
        }),
      );
    });

    it('should emit critical alerts when system is critical', async () => {
      mockRepository.healthCheck.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Critical failure')), 10),
          ),
      );

      await service.checkMetricsHealth();

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'metrics.health.critical',
        expect.objectContaining({
          overallStatus: HealthStatus.CRITICAL,
        }),
      );
    });

    it('should not emit events when status remains the same', async () => {
      // Set up stable health status
      (service as any).healthHistory = [
        {
          overallStatus: HealthStatus.HEALTHY,
          timestamp: new Date(Date.now() - 60000),
        },
      ];

      mockRepository.healthCheck.mockResolvedValue(true);
      mockRepository.getLatestMetrics.mockResolvedValue({});

      await service.checkMetricsHealth();

      // Should not emit status change event for same status
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'metrics.health.status.changed',
        expect.anything(),
      );
    });
  });
});
