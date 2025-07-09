import { Module } from '@nestjs/common';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsMetricsService } from './sms.metrics';

@Module({
  controllers: [SmsController],
  providers: [SmsService, SmsMetricsService],
  exports: [SmsService, SmsMetricsService],
})
export class SmsModule {}