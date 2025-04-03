import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http.metrics.interceptor';
import { CoreMetricsService } from './core.metrics';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describe, expect, it, jest, beforeEach } from 'bun:test';

describe('HttpMetricsInterceptor', () => {
  let interceptor: HttpMetricsInterceptor;
  let metricsService: CoreMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpMetricsInterceptor,
        CoreMetricsService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<HttpMetricsInterceptor>(HttpMetricsInterceptor);
    metricsService = module.get<CoreMetricsService>(CoreMetricsService);

    // Mock recordApiMetric
    metricsService.recordApiMetric = jest.fn();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should record metrics for successful HTTP requests', (done) => {
    const executionContext = createMockExecutionContext('GET', '/users/123');
    const next: CallHandler = {
      handle: () => of({ data: 'test' }),
    };

    interceptor.intercept(executionContext, next).subscribe({
      next: () => {
        expect(metricsService.recordApiMetric).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            path: '/users/:id',
            statusCode: 200,
            success: true,
            duration: expect.any(Number),
          }),
        );
        done();
      },
    });
  });

  it('should record metrics for failed HTTP requests', (done) => {
    const executionContext = createMockExecutionContext('POST', '/users');
    const error = new Error('Test error');
    (error as any).status = 400;
    const next: CallHandler = {
      handle: () => throwError(() => error),
    };

    interceptor.intercept(executionContext, next).subscribe({
      error: () => {
        expect(metricsService.recordApiMetric).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            path: '/users',
            statusCode: 400,
            success: false,
            duration: expect.any(Number),
            errorType: 'Error',
          }),
        );
        done();
      },
    });
  });

  it('should normalize paths correctly', () => {
    // Use private method for testing
    const normalizePath = (interceptor as any).normalizePath.bind(interceptor);
    
    expect(normalizePath('/users/123')).toBe('/users/:id');
    expect(normalizePath('/users/123/posts/456')).toBe('/users/:id/posts/:id');
    // Numbers that are part of segment names should not be replaced
    expect(normalizePath('/users/abc123')).toBe('/users/abc123');
    expect(normalizePath('/users/123?sort=name')).toBe('/users/:id');
    expect(normalizePath('/users/550e8400-e29b-41d4-a716-446655440000')).toBe('/users/:uuid');
    expect(normalizePath('/users/550e8400e29b41d4a716446655440000')).toBe('/users/:hash');
  });

  // Helper function to create mock execution context
  function createMockExecutionContext(method: string, url: string): ExecutionContext {
    const mockRequest = {
      method,
      url,
      body: { test: 'data' },
    };

    const mockResponse = {
      statusCode: 200,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getArgByIndex: jest.fn(),
      getArgs: jest.fn(),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getType: () => 'http',
    } as unknown as ExecutionContext;
  }
});