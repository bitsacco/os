import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import {
  ISmsProvider,
  SendSmsResult,
  SendBulkSmsResult,
} from '../interfaces/sms-provider.interface';

@Injectable()
export class TwilioProvider implements ISmsProvider {
  private readonly logger = new Logger(TwilioProvider.name);
  private client: Twilio | null = null;
  private fromNumber: string | null = null;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {
    // Lazy initialization - only initialize when provider is actually used
    // This allows the module to load even if Twilio credentials aren't configured
  }

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    // Get credentials - only throw if Twilio is actually being used
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !this.fromNumber) {
      throw new Error(
        'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_PHONE_NUMBER environment variables.',
      );
    }

    // Check for API Key authentication (recommended)
    const apiKeySid = this.configService.get<string>('TWILIO_API_KEY_SID');
    const apiKeySecret = this.configService.get<string>(
      'TWILIO_API_KEY_SECRET',
    );

    if (apiKeySid && apiKeySecret) {
      // Use API Key authentication (more secure)
      this.client = new Twilio(apiKeySid, apiKeySecret, {
        accountSid,
      });
      this.logger.log(
        'Twilio provider initialized with API Key authentication',
      );
    } else {
      // Fallback to Auth Token authentication
      const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

      if (!authToken) {
        throw new Error(
          'Twilio authentication not configured. Please set either TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET or TWILIO_AUTH_TOKEN environment variables.',
        );
      }

      this.client = new Twilio(accountSid, authToken);
      this.logger.log(
        'Twilio provider initialized with Auth Token authentication',
      );
    }

    this.initialized = true;
  }

  async sendSms(message: string, receiver: string): Promise<SendSmsResult> {
    this.ensureInitialized();

    try {
      const response = await this.client!.messages.create({
        body: message,
        from: this.fromNumber!,
        to: receiver,
      });

      this.logger.log(
        `Twilio SMS sent - SID: ${response.sid}, status: ${response.status}`,
      );

      return {
        messageId: response.sid,
        status: response.status,
      };
    } catch (error) {
      this.logger.error(`Twilio error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendBulkSms(
    message: string,
    receivers: string[],
  ): Promise<SendBulkSmsResult> {
    this.ensureInitialized();

    const BATCH_SIZE = 10;
    const DELAY_MS = 1000;

    const batches = [];
    for (let i = 0; i < receivers.length; i += BATCH_SIZE) {
      batches.push(receivers.slice(i, i + BATCH_SIZE));
    }

    let successful = 0;
    let failed = 0;
    const results = [];

    for (const batch of batches) {
      const promises = batch.map(async (receiver) => {
        try {
          const response = await this.client!.messages.create({
            body: message,
            from: this.fromNumber!,
            to: receiver,
          });
          return {
            receiver,
            success: true,
            messageId: response.sid,
          };
        } catch (error) {
          return {
            receiver,
            success: false,
            error: error.message,
          };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      successful += batchResults.filter((r) => r.success).length;
      failed += batchResults.filter((r) => !r.success).length;

      // Delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    this.logger.log(
      `Twilio bulk SMS completed: ${successful} sent, ${failed} failed`,
    );

    return {
      successful,
      failed,
      results,
    };
  }

  getProviderName(): string {
    return 'twilio';
  }
}
