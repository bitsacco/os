import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsMetricsService } from './sms.metrics';
import { TwilioProvider } from './providers/twilio.provider';
import { AfricasTalkingProvider } from './providers/africastalking.provider';
import { SmsProviderFactory } from './providers/sms-provider.factory';

@Module({
  imports: [SharedModule],
  controllers: [SmsController],
  providers: [
    SmsService,
    SmsMetricsService,
    TwilioProvider,
    AfricasTalkingProvider,
    SmsProviderFactory,
  ],
  exports: [SmsService, SmsMetricsService],
})
export class SmsModule {}
