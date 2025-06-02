import africastalking from 'africastalking';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseDomainService } from '../../../shared/domain/base-domain.service';
import { BusinessMetricsService } from '../../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../infrastructure/monitoring/telemetry.service';

// Define interfaces locally to avoid import issues
export interface SendSmsDto {
  message: string;
  receiver: string;
}

export interface SendBulkSmsDto {
  message: string;
  receivers: string[];
}

@Injectable()
export class SmsService extends BaseDomainService {
  protected readonly logger = new Logger(SmsService.name);
  private at;
  private smsconfig: { from: string; keyword: string };

  constructor(
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metricsService: BusinessMetricsService,
    protected readonly telemetryService: TelemetryService,
    private readonly configService: ConfigService,
  ) {
    super(eventEmitter, metricsService, telemetryService);
    this.logger.log('Communications SMS Service initialized');

    this.at = africastalking({
      apiKey: this.configService.getOrThrow<string>('SMS_AT_API_KEY'),
      username: this.configService.getOrThrow<string>('SMS_AT_USERNAME'),
    });

    this.smsconfig = {
      from: this.configService.getOrThrow<string>('SMS_AT_FROM'),
      keyword: this.configService.getOrThrow<string>('SMS_AT_KEYWORD'),
    };
  }

  async sendSms({ message, receiver }: SendSmsDto): Promise<void> {
    return this.executeWithErrorHandling('sendSms', async () => {
      this.logger.log(`Sending SMS to ${receiver} with message: ${message}`);
      const startTime = Date.now();

      try {
        const response = await this.at.SMS.send({
          ...this.smsconfig,
          to: receiver,
          message,
        });

        this.logger.log(`SMS sent successfully: ${JSON.stringify(response)}`);

        // Record successful SMS metric
        await this.metricsService.recordCommunicationMetric(
          'sms',
          'send',
          true,
          Date.now() - startTime,
          {
            receiver,
            messageLength: message.length,
          },
        );
      } catch (error) {
        this.logger.error(`Error sending SMS: ${error.message}`, error.stack);

        // Record failed SMS metric
        await this.metricsService.recordCommunicationMetric(
          'sms',
          'send',
          false,
          Date.now() - startTime,
          {
            receiver,
            messageLength: message.length,
            errorType: error.message || 'unknown_error',
          },
        );

        throw error;
      }
    });
  }

  async sendBulkSms({ message, receivers }: SendBulkSmsDto): Promise<void> {
    return this.executeWithErrorHandling('sendBulkSms', async () => {
      this.logger.log(
        `Sending bulk SMS to ${receivers.length} recipients with message: ${message}`,
      );
      const startTime = Date.now();

      try {
        const response = await this.at.SMS.send({
          ...this.smsconfig,
          to: receivers,
          message,
        });

        this.logger.log(
          `Bulk SMS sent successfully: ${JSON.stringify(response)}`,
        );

        // Record successful bulk SMS metric
        await this.metricsService.recordCommunicationMetric(
          'sms',
          'bulk_send',
          true,
          Date.now() - startTime,
          {
            receiverCount: receivers.length,
            messageLength: message.length,
          },
        );
      } catch (error) {
        this.logger.error(
          `Error sending bulk SMS: ${error.message}`,
          error.stack,
        );

        // Record failed bulk SMS metric
        await this.metricsService.recordCommunicationMetric(
          'sms',
          'bulk_send',
          false,
          Date.now() - startTime,
          {
            receiverCount: receivers.length,
            messageLength: message.length,
            errorType: error.message || 'unknown_error',
          },
        );

        throw error;
      }
    });
  }

  // Legacy compatibility methods for microservice interface
  async sendSmsLegacy(request: SendSmsDto): Promise<void> {
    return this.sendSms(request);
  }

  async sendBulkSmsLegacy(request: SendBulkSmsDto): Promise<void> {
    return this.sendBulkSms(request);
  }
}
