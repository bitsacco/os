import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseDomainService } from './base-domain.service';
import { DomainEvent } from './types';
import { BusinessMetricsService } from '../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../infrastructure/monitoring/telemetry.service';
import {
  MockBusinessMetricsService,
  MockTelemetryService,
} from '../../../test/mocks/external-services.mock';

// Test implementation of BaseDomainService
class TestDomainService extends BaseDomainService {
  async testOperation(shouldFail: boolean = false): Promise<string> {
    return this.executeWithErrorHandling(
      'testOperation',
      async () => {
        if (shouldFail) {
          throw new Error('Test operation failed');
        }
        return 'success';
      },
      'test-user-id',
    );
  }

  async testEventPublishing(): Promise<void> {
    const event = this.createEvent(
      'test.event.created',
      'test-aggregate-id',
      'TestAggregate',
      { message: 'Test event' },
      'test-user-id',
    );

    await this.publishEvent(event);
  }
}

describe('BaseDomainService', () => {
  let service: TestDomainService;
  let eventEmitter: EventEmitter2;
  let metricsService: MockBusinessMetricsService;
  let telemetryService: MockTelemetryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestDomainService,
        {
          provide: EventEmitter2,
          useValue: {
            emitAsync: jest.fn(),
          },
        },
        {
          provide: BusinessMetricsService,
          useClass: MockBusinessMetricsService,
        },
        {
          provide: TelemetryService,
          useClass: MockTelemetryService,
        },
      ],
    }).compile();

    service = module.get<TestDomainService>(TestDomainService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    metricsService = module.get<MockBusinessMetricsService>(
      BusinessMetricsService,
    );
    telemetryService = module.get<MockTelemetryService>(TelemetryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    metricsService.clearEvents();
    telemetryService.clearSpans();
    telemetryService.clearEvents();
  });

  describe('executeWithErrorHandling', () => {
    it('should execute operation successfully and record metrics', async () => {
      const result = await service.testOperation(false);

      expect(result).toBe('success');

      const spans = telemetryService.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].operationName).toBe('testdomainservice.testOperation');
      expect(spans[0].success).toBe(true);

      const events = metricsService.getEvents();
      const operationEvent = events.find(
        (e) => e.type === 'operation_duration',
      );
      expect(operationEvent).toBeDefined();
      expect(operationEvent.operation).toBe('TestDomainService.testOperation');
      expect(operationEvent.success).toBe(true);
    });

    it('should handle errors and record error metrics', async () => {
      await expect(service.testOperation(true)).rejects.toThrow(
        'Test operation failed',
      );

      const spans = telemetryService.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].success).toBe(false);
      expect(spans[0].error).toBe('Test operation failed');

      const events = metricsService.getEvents();
      const errorEvent = events.find((e) => e.type === 'domain_error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.domain).toBe('TestDomainService');
      expect(errorEvent.errorType).toBe('testOperation');

      const operationEvent = events.find(
        (e) => e.type === 'operation_duration',
      );
      expect(operationEvent).toBeDefined();
      expect(operationEvent.success).toBe(false);
    });

    it('should include userId in telemetry attributes', async () => {
      await service.testOperation(false);

      const spans = telemetryService.getSpans();
      expect(spans[0].attributes).toEqual({ 'user.id': 'test-user-id' });
    });
  });

  describe('publishEvent', () => {
    it('should publish domain event successfully', async () => {
      await service.testEventPublishing();

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'test.event.created',
        expect.objectContaining({
          eventType: 'test.event.created',
          aggregateId: 'test-aggregate-id',
          aggregateType: 'TestAggregate',
          payload: { message: 'Test event' },
          userId: 'test-user-id',
          timestamp: expect.any(Date),
          version: 1,
        }),
      );

      const telemetryEvents = telemetryService.getEvents();
      expect(telemetryEvents).toContainEqual(
        expect.objectContaining({
          name: 'domain_event_published',
          attributes: {
            event_type: 'test.event.created',
            aggregate_type: 'TestAggregate',
            aggregate_id: 'test-aggregate-id',
          },
        }),
      );
    });

    it('should handle event publishing errors', async () => {
      const error = new Error('Event emission failed');
      (eventEmitter.emitAsync as jest.Mock).mockRejectedValue(error);

      await expect(service.testEventPublishing()).rejects.toThrow(
        'Event emission failed',
      );

      const events = metricsService.getEvents();
      const errorEvent = events.find((e) => e.type === 'domain_error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.domain).toBe('TestAggregate');
      expect(errorEvent.errorType).toBe('event_publish_failed');
    });
  });

  describe('createEvent', () => {
    it('should create domain event with all required fields', () => {
      const event = service['createEvent'](
        'test.created',
        'aggregate-123',
        'TestEntity',
        { data: 'test' },
        'user-456',
      );

      expect(event).toEqual({
        eventType: 'test.created',
        aggregateId: 'aggregate-123',
        aggregateType: 'TestEntity',
        payload: { data: 'test' },
        userId: 'user-456',
      });
    });

    it('should create domain event without userId', () => {
      const event = service['createEvent'](
        'test.created',
        'aggregate-123',
        'TestEntity',
        { data: 'test' },
      );

      expect(event).toEqual({
        eventType: 'test.created',
        aggregateId: 'aggregate-123',
        aggregateType: 'TestEntity',
        payload: { data: 'test' },
        userId: undefined,
      });
    });
  });

  describe('logging', () => {
    it('should log successful event publishing', async () => {
      const logSpy = jest.spyOn(service['logger'], 'debug');

      await service.testEventPublishing();

      expect(logSpy).toHaveBeenCalledWith(
        'Domain event published: test.event.created',
        {
          aggregateType: 'TestAggregate',
          aggregateId: 'test-aggregate-id',
        },
      );
    });

    it('should log errors during event publishing', async () => {
      const error = new Error('Event emission failed');
      (eventEmitter.emitAsync as jest.Mock).mockRejectedValue(error);

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.testEventPublishing()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to publish domain event: test.event.created',
        error,
      );
    });

    it('should log operation failures', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.testOperation(true)).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        'Operation failed: testOperation',
        expect.any(Error),
      );
    });
  });

  describe('performance measurement', () => {
    it('should measure operation duration', async () => {
      const startTime = Date.now();
      await service.testOperation(false);
      const endTime = Date.now();

      const events = metricsService.getEvents();
      const operationEvent = events.find(
        (e) => e.type === 'operation_duration',
      );

      expect(operationEvent).toBeDefined();
      expect(operationEvent.duration).toBeGreaterThanOrEqual(0);
      expect(operationEvent.duration).toBeLessThan(endTime - startTime + 10); // Allow small buffer
    });

    it('should measure duration even for failed operations', async () => {
      await expect(service.testOperation(true)).rejects.toThrow();

      const events = metricsService.getEvents();
      const operationEvent = events.find(
        (e) => e.type === 'operation_duration',
      );

      expect(operationEvent).toBeDefined();
      expect(operationEvent.duration).toBeGreaterThanOrEqual(0);
      expect(operationEvent.success).toBe(false);
    });
  });
});
