import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from '../interfaces/sms-provider.interface';
import { TwilioProvider } from './twilio.provider';
import { AfricasTalkingProvider } from './africastalking.provider';

export type SmsProviderType = 'twilio' | 'africastalking';

@Injectable()
export class SmsProviderFactory {
  private readonly logger = new Logger(SmsProviderFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly twilioProvider: TwilioProvider,
    private readonly africasTalkingProvider: AfricasTalkingProvider,
  ) {}

  createProvider(): ISmsProvider {
    const providerType = this.configService.get<SmsProviderType>(
      'SMS_PROVIDER',
      'twilio', // Default to Twilio
    );

    this.logger.log(`Creating SMS provider: ${providerType}`);

    switch (providerType) {
      case 'twilio':
        return this.twilioProvider;
      case 'africastalking':
        return this.africasTalkingProvider;
      default:
        this.logger.warn(
          `Unknown SMS provider: ${providerType}, defaulting to Twilio`,
        );
        return this.twilioProvider;
    }
  }

  getProviderType(): SmsProviderType {
    return this.configService.get<SmsProviderType>('SMS_PROVIDER', 'twilio');
  }
}
