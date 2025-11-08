import { Injectable, Logger } from '@nestjs/common';
import { SendBulkSmsDto, SendSmsDto } from '../common';
import { SmsMetricsService } from './sms.metrics';
import { SmsProviderFactory } from './providers/sms-provider.factory';
import { ISmsProvider } from './interfaces/sms-provider.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: ISmsProvider;

  constructor(
    private readonly providerFactory: SmsProviderFactory,
    private readonly metricsService: SmsMetricsService,
  ) {
    this.provider = this.providerFactory.createProvider();
    this.logger.log(
      `SmsService initialized with ${this.provider.getProviderName()} provider`,
    );
  }

  async sendSms({ message, receiver }: SendSmsDto): Promise<void> {
    this.logger.log(
      `Sending SMS to ${receiver} via ${this.provider.getProviderName()}`,
    );
    const startTime = Date.now();
    let errorType: string | undefined;

    try {
      const result = await this.provider.sendSms(message, receiver);

      this.logger.log(
        `SMS sent - ID: ${result.messageId}, status: ${result.status}`,
      );

      // Record successful SMS metric
      this.metricsService.recordSmsMetric({
        receiver,
        messageLength: message.length,
        success: true,
        duration: Date.now() - startTime,
        provider: this.provider.getProviderName(),
      });
    } catch (error) {
      errorType = error.message || 'Unknown error';
      this.logger.error(`Error sending SMS: ${errorType}`, error.stack);

      // Record failed SMS metric
      this.metricsService.recordSmsMetric({
        receiver,
        messageLength: message.length,
        success: false,
        duration: Date.now() - startTime,
        errorType,
        provider: this.provider.getProviderName(),
      });

      throw error;
    }
  }

  async sendBulkSms({ message, receivers }: SendBulkSmsDto): Promise<void> {
    this.logger.log(
      `Sending bulk SMS to ${receivers.length} recipients via ${this.provider.getProviderName()}`,
    );
    const startTime = Date.now();
    let errorType: string | undefined;

    try {
      const result = await this.provider.sendBulkSms(message, receivers);

      this.logger.log(
        `Bulk SMS completed: ${result.successful} sent, ${result.failed} failed`,
      );

      // Record successful bulk SMS metric
      this.metricsService.recordSmsBulkMetric({
        receiverCount: receivers.length,
        messageLength: message.length,
        success: result.failed === 0,
        duration: Date.now() - startTime,
        provider: this.provider.getProviderName(),
      });

      if (result.successful === 0 && result.failed > 0) {
        throw new Error(`All ${result.failed} bulk SMS messages failed`);
      }
    } catch (error) {
      errorType = error.message || 'Unknown error';
      this.logger.error(`Error sending bulk SMS: ${errorType}`, error.stack);

      // Record failed bulk SMS metric
      this.metricsService.recordSmsBulkMetric({
        receiverCount: receivers.length,
        messageLength: message.length,
        success: false,
        duration: Date.now() - startTime,
        errorType,
        provider: this.provider.getProviderName(),
      });

      throw error;
    }
  }
}
