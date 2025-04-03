import * as africastalking from 'africastalking';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { SendBulkSmsDto, SendSmsDto } from '@bitsacco/common';
import { SmsMetricsService } from './sms.metrics';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private at;
  private smsconfig: { from: string; keyword: string };

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: SmsMetricsService,
  ) {
    this.logger.log('SmsService created');

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
    this.logger.log(`Sending sms to ${receiver} with message ${message}`);
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      const response = await this.at.SMS.send({
        ...this.smsconfig,
        to: receiver,
        message,
      });

      this.logger.log(`Sms sent with response ${JSON.stringify(response)}`);

      // Record successful SMS metric
      success = true;
      this.metricsService.recordSmsMetric({
        receiver,
        messageLength: message.length,
        success: true,
        duration: Date.now() - startTime,
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
      });

      throw error;
    }
  }

  async sendBulkSms({ message, receivers }: SendBulkSmsDto): Promise<void> {
    this.logger.log(
      `Sending bulk sms to ${receivers} with messages ${message}`,
    );
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      const response = await this.at.SMS.send({
        ...this.smsconfig,
        to: receivers,
        message,
      });

      this.logger.log(
        `Bulk sms sent with response ${JSON.stringify(response)}`,
      );

      // Record successful bulk SMS metric
      success = true;
      this.metricsService.recordSmsBulkMetric({
        receiverCount: receivers.length,
        messageLength: message.length,
        success: true,
        duration: Date.now() - startTime,
      });
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
      });

      throw error;
    }
  }
}
