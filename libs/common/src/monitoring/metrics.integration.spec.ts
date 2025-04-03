import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MetricsIntegration } from './metrics.integration';
import { HttpMetricsInterceptor } from './http.metrics.interceptor';
import { GrpcMetricsInterceptor } from './grpc.metrics.interceptor';
import { DatabaseMetricsMiddleware } from './database.metrics.middleware';
import { CoreMetricsService } from './core.metrics';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describe, expect, it, jest, beforeEach } from 'bun:test';

describe('MetricsIntegration', () => {
  let app: INestApplication;
  let metricsService: CoreMetricsService;
  let databaseMetricsMiddleware: DatabaseMetricsMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoreMetricsService,
        DatabaseMetricsMiddleware,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    app = {
      useGlobalInterceptors: jest.fn(),
    } as unknown as INestApplication;

    metricsService = module.get<CoreMetricsService>(CoreMetricsService);
    databaseMetricsMiddleware = module.get<DatabaseMetricsMiddleware>(
      DatabaseMetricsMiddleware,
    );
  });

  it('should apply HTTP metrics interceptor', () => {
    MetricsIntegration.applyHttpMetricsInterceptor(app, metricsService);

    expect(app.useGlobalInterceptors).toHaveBeenCalledWith(
      expect.any(HttpMetricsInterceptor),
    );
  });

  it('should apply gRPC metrics interceptor', () => {
    MetricsIntegration.applyGrpcMetricsInterceptor(app, metricsService);

    expect(app.useGlobalInterceptors).toHaveBeenCalledWith(
      expect.any(GrpcMetricsInterceptor),
    );
  });

  it('should apply database metrics middleware', () => {
    const mockSchema = {
      pre: jest.fn(),
      post: jest.fn(),
    };
    const collectionName = 'users';

    // Spy on the applyMiddleware method
    const spy = jest.spyOn(databaseMetricsMiddleware, 'applyMiddleware');

    MetricsIntegration.applyDatabaseMetricsMiddleware(
      mockSchema,
      collectionName,
      databaseMetricsMiddleware,
    );

    expect(spy).toHaveBeenCalledWith(mockSchema, collectionName);
  });

  it('should apply all metrics interceptors', () => {
    MetricsIntegration.applyAllMetricsInterceptors(app, metricsService);

    // Should apply both HTTP and gRPC interceptors
    expect(app.useGlobalInterceptors).toHaveBeenCalledTimes(2);
  });
});