import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as africastalking from 'africastalking';
import {
  ISmsProvider,
  SendSmsResult,
  SendBulkSmsResult,
} from '../interfaces/sms-provider.interface';

@Injectable()
export class AfricasTalkingProvider implements ISmsProvider {
  private readonly logger = new Logger(AfricasTalkingProvider.name);
  private readonly client: any;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('SMS_AT_API_KEY');
    const username = this.configService.getOrThrow<string>('SMS_AT_USERNAME');
    this.from = this.configService.getOrThrow<string>('SMS_AT_FROM');

    this.client = africastalking({
      apiKey,
      username,
    });

    this.logger.log("Africa's Talking provider initialized");
  }

  async sendSms(message: string, receiver: string): Promise<SendSmsResult> {
    try {
      const response = await this.client.SMS.send({
        to: receiver,
        message,
        from: this.from,
      });

      this.logger.log(
        `Africa's Talking SMS sent - Recipients: ${response.SMSMessageData.Recipients.length}`,
      );

      // Extract message ID from first recipient
      const recipient = response.SMSMessageData.Recipients[0];
      return {
        messageId: recipient.messageId || 'unknown',
        status: recipient.status,
      };
    } catch (error) {
      this.logger.error(
        `Africa's Talking error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async sendBulkSms(
    message: string,
    receivers: string[],
  ): Promise<SendBulkSmsResult> {
    try {
      const response = await this.client.SMS.send({
        to: receivers,
        message,
        from: this.from,
      });

      const recipients = response.SMSMessageData.Recipients;
      const successful = recipients.filter(
        (r: any) => r.status === 'Success',
      ).length;
      const failed = recipients.filter(
        (r: any) => r.status !== 'Success',
      ).length;

      const results = recipients.map((r: any) => ({
        receiver: r.number,
        success: r.status === 'Success',
        messageId: r.messageId,
        error: r.status !== 'Success' ? r.status : undefined,
      }));

      this.logger.log(
        `Africa's Talking bulk SMS completed: ${successful} sent, ${failed} failed`,
      );

      return {
        successful,
        failed,
        results,
      };
    } catch (error) {
      this.logger.error(
        `Africa's Talking bulk error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  getProviderName(): string {
    return 'africastalking';
  }
}
