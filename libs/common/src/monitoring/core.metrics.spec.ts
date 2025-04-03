import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  CoreMetricsService, 
  CORE_DATABASE_METRIC, 
  CORE_API_METRIC, 
  CORE_GRPC_METRIC,
  CORE_RESOURCE_METRIC
} from './core.metrics';

describe('CoreMetricsService', () => {
  let service: CoreMetricsService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoreMetricsService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CoreMetricsService>(CoreMetricsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordDatabaseMetric', () => {
    it('should record database operation metrics and emit event', () => {
      const metric = {
        operation: 'find' as const,
        collection: 'users',
        success: true,
        duration: 50,
      };

      service.recordDatabaseMetric(metric);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CORE_DATABASE_METRIC,
        expect.objectContaining({
          ...metric,
          timestamp: expect.any(String),
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.database.operations).toBe(1);
      expect(metrics.database.successful).toBe(1);
      expect(metrics.database.byCollection.users.total).toBe(1);
      expect(metrics.database.byOperation.find.total).toBe(1);
    });

    it('should track failed database operations', () => {
      const metric = {
        operation: 'find' as const,
        collection: 'users',
        success: false,
        duration: 50,
        errorType: 'connection_error',
      };

      service.recordDatabaseMetric(metric);

      const metrics = service.getMetrics();
      expect(metrics.database.operations).toBe(1);
      expect(metrics.database.failed).toBe(1);
      expect(metrics.database.byCollection.users.failed).toBe(1);
      expect(metrics.database.byOperation.find.failed).toBe(1);
      expect(metrics.errors.connection_error).toBe(1);
    });
  });

  describe('recordApiMetric', () => {
    it('should record API request metrics and emit event', () => {
      const metric = {
        method: 'GET',
        path: '/api/users',
        statusCode: 200,
        success: true,
        duration: 100,
      };

      service.recordApiMetric(metric);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CORE_API_METRIC,
        expect.objectContaining({
          ...metric,
          timestamp: expect.any(String),
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.api.requests).toBe(1);
      expect(metrics.api.successful).toBe(1);
      expect(metrics.api.byMethod.GET.total).toBe(1);
      expect(metrics.api.byPath['/api/users'].total).toBe(1);
      expect(metrics.api.byStatusCode['200']).toBe(1);
    });

    it('should track failed API requests', () => {
      const metric = {
        method: 'GET',
        path: '/api/users',
        statusCode: 500,
        success: false,
        duration: 100,
        errorType: 'server_error',
      };

      service.recordApiMetric(metric);

      const metrics = service.getMetrics();
      expect(metrics.api.requests).toBe(1);
      expect(metrics.api.failed).toBe(1);
      expect(metrics.api.byMethod.GET.failed).toBe(1);
      expect(metrics.api.byPath['/api/users'].failed).toBe(1);
      expect(metrics.api.byStatusCode['500']).toBe(1);
      expect(metrics.errors.server_error).toBe(1);
    });
  });

  describe('recordGrpcMetric', () => {
    it('should record gRPC request metrics and emit event', () => {
      const metric = {
        service: 'UserService',
        method: 'FindUser',
        success: true,
        duration: 75,
      };

      service.recordGrpcMetric(metric);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CORE_GRPC_METRIC,
        expect.objectContaining({
          ...metric,
          timestamp: expect.any(String),
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.grpc.requests).toBe(1);
      expect(metrics.grpc.successful).toBe(1);
      expect(metrics.grpc.byService.UserService.total).toBe(1);
      expect(metrics.grpc.byMethod.FindUser.total).toBe(1);
    });
  });

  describe('recordResourceMetric', () => {
    it('should record CPU usage metrics and emit event', () => {
      const metric = {
        resource: 'cpu' as const,
        value: 45.5,
        unit: '%',
      };

      service.recordResourceMetric(metric);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CORE_RESOURCE_METRIC,
        expect.objectContaining({
          ...metric,
          timestamp: expect.any(String),
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.resources.cpu.current).toBe(45.5);
    });

    it('should record memory usage metrics', () => {
      const metric = {
        resource: 'memory' as const,
        value: 1024,
        unit: 'MB',
      };

      service.recordResourceMetric(metric);

      const metrics = service.getMetrics();
      expect(metrics.resources.memory.current).toBe(1024);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to zero', () => {
      // Record some metrics first
      service.recordDatabaseMetric({
        operation: 'find' as const,
        collection: 'users',
        success: true,
        duration: 50,
      });

      service.recordApiMetric({
        method: 'GET',
        path: '/api/users',
        statusCode: 200,
        success: true,
        duration: 100,
      });

      // Verify metrics were recorded
      let metrics = service.getMetrics();
      expect(metrics.database.operations).toBe(1);
      expect(metrics.api.requests).toBe(1);

      // Reset metrics
      service.resetMetrics();

      // Verify metrics were reset
      metrics = service.getMetrics();
      expect(metrics.database.operations).toBe(0);
      expect(metrics.api.requests).toBe(0);
      expect(metrics.database.byCollection).toEqual({});
      expect(metrics.api.byMethod).toEqual({});
    });
  });
});