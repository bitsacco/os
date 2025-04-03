import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { GrpcMetricsInterceptor } from './grpc.metrics.interceptor';
import { CoreMetricsService } from './core.metrics';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describe, expect, it, jest, beforeEach } from 'bun:test';

describe('GrpcMetricsInterceptor', () => {
  let interceptor: GrpcMetricsInterceptor;
  let metricsService: CoreMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrpcMetricsInterceptor,
        CoreMetricsService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<GrpcMetricsInterceptor>(GrpcMetricsInterceptor);
    metricsService = module.get<CoreMetricsService>(CoreMetricsService);

    // Mock recordGrpcMetric
    metricsService.recordGrpcMetric = jest.fn();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should record metrics for successful gRPC requests', (done) => {
    const executionContext = createMockExecutionContext(
      'UserService',
      'getUser',
    );
    const next: CallHandler = {
      handle: () => of({ data: 'test' }),
    };

    interceptor.intercept(executionContext, next).subscribe({
      next: () => {
        expect(metricsService.recordGrpcMetric).toHaveBeenCalledWith(
          expect.objectContaining({
            service: 'User',
            method: 'getUser',
            success: true,
            duration: expect.any(Number),
          }),
        );
        done();
      },
    });
  });

  it('should record metrics for failed gRPC requests', (done) => {
    const executionContext = createMockExecutionContext(
      'UserService',
      'createUser',
    );
    const error = new Error('Invalid request');
    (error as any).code = 'INVALID_ARGUMENT';
    const next: CallHandler = {
      handle: () => throwError(() => error),
    };

    interceptor.intercept(executionContext, next).subscribe({
      error: () => {
        expect(metricsService.recordGrpcMetric).toHaveBeenCalledWith(
          expect.objectContaining({
            service: 'User',
            method: 'createUser',
            success: false,
            duration: expect.any(Number),
            errorType: 'INVALID_ARGUMENT',
          }),
        );
        done();
      },
    });
  });

  // Helper function to create mock execution context
  function createMockExecutionContext(
    serviceName: string,
    methodName: string,
  ): ExecutionContext {
    const mockRpcContext = {
      getData: () => ({ test: 'data' }),
      getContext: () => ({ requestId: '123' }),
    };

    return {
      switchToRpc: () => mockRpcContext,
      getArgByIndex: jest.fn(),
      getArgs: jest.fn(),
      getClass: () => ({ name: serviceName }),
      getHandler: () => ({ name: methodName }),
      getType: () => 'rpc',
    } as unknown as ExecutionContext;
  }
});
