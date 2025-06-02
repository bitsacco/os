import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BusinessMetricsService } from '../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../infrastructure/monitoring/telemetry.service';
import { DomainEvent } from './types';

@Injectable()
export abstract class BaseDomainService {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metricsService: BusinessMetricsService,
    protected readonly telemetryService: TelemetryService,
  ) {}

  protected async publishEvent(
    event: Omit<DomainEvent, 'timestamp' | 'version'>,
  ): Promise<void> {
    const domainEvent = new DomainEvent({
      ...event,
      timestamp: new Date(),
      version: 1,
    });

    try {
      await this.eventEmitter.emitAsync(event.eventType, domainEvent);

      await this.telemetryService.executeWithSpan(
        'domain.event.published',
        async () => {
          this.telemetryService.recordEvent('domain_event_published', {
            event_type: event.eventType,
            aggregate_type: event.aggregateType,
            aggregate_id: event.aggregateId,
          });
        },
        {
          'event.type': event.eventType,
          'event.aggregate.type': event.aggregateType,
          'event.aggregate.id': event.aggregateId,
        },
      );

      this.logger.debug(`Domain event published: ${event.eventType}`, {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish domain event: ${event.eventType}`,
        error,
      );
      await this.metricsService.recordDomainError(
        event.aggregateType,
        'event_publish_failed',
        error as Error,
        event.userId,
      );
      throw error;
    }
  }

  protected async executeWithErrorHandling<T>(
    operation: string,
    fn: () => Promise<T>,
    userId?: string,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await this.telemetryService.executeWithSpan(
        `${this.constructor.name.toLowerCase()}.${operation}`,
        fn,
        { 'user.id': userId || 'unknown' },
      );

      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        `${this.constructor.name}.${operation}`,
        duration,
        true,
        { userId },
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.metricsService.recordDomainError(
        this.constructor.name,
        operation,
        error as Error,
        userId,
      );

      await this.metricsService.recordOperationDuration(
        `${this.constructor.name}.${operation}`,
        duration,
        false,
        { userId, error: (error as Error).message },
      );

      this.logger.error(`Operation failed: ${operation}`, error);
      throw error;
    }
  }

  protected createEvent(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    payload: any,
    userId?: string,
  ): Omit<DomainEvent, 'timestamp' | 'version'> {
    return {
      eventType,
      aggregateId,
      aggregateType,
      payload,
      userId,
    };
  }
}
