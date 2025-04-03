import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError, lastValueFrom, firstValueFrom } from 'rxjs';
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

    // Create a more complete mock of the metrics service
    jest.spyOn(metricsService, 'recordGrpcMetric').mockImplementation(() => {
      // Do nothing
    });
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should record metrics for successful gRPC requests', async () => {
    const executionContext = createMockExecutionContext(
      'UserService',
      'getUser',
    );
    const next: CallHandler = {
      handle: () => of({ data: 'test' }),
    };

    await firstValueFrom(interceptor.intercept(executionContext, next));
    
    expect(metricsService.recordGrpcMetric).toHaveBeenCalled();
    
    const calls = (metricsService.recordGrpcMetric as jest.Mock).mock.calls;
    const callArg = calls[0][0];
    
    expect(callArg.service).toBe('UserService');
    expect(callArg.method).toBe('getUser');
    expect(callArg.success).toBe(true);
    expect(typeof callArg.duration).toBe('number');
  });

  it('should record metrics for failed gRPC requests', async () => {
    const executionContext = createMockExecutionContext(
      'UserService',
      'createUser',
    );
    const error = new Error('Invalid request');
    (error as any).code = 'INVALID_ARGUMENT';
    const next: CallHandler = {
      handle: () => throwError(() => error),
    };

    try {
      await firstValueFrom(interceptor.intercept(executionContext, next));
      // Should not reach here
      expect(true).toBe(false);
    } catch (e) {
      // Error is expected
      expect(metricsService.recordGrpcMetric).toHaveBeenCalled();
      
      const calls = (metricsService.recordGrpcMetric as jest.Mock).mock.calls;
      const callArg = calls[calls.length - 1][0];
      
      expect(callArg.service).toBe('UserService');
      expect(callArg.method).toBe('createUser');
      expect(callArg.success).toBe(false);
      expect(typeof callArg.duration).toBe('number');
      expect(callArg.errorType).toBe('INVALID_ARGUMENT');
    }
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
