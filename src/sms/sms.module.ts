import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsMetricsService } from './sms.metrics';

@Module({
  imports: [SharedModule],
  controllers: [SmsController],
  providers: [SmsService, SmsMetricsService],
  exports: [SmsService, SmsMetricsService],
})
export class SmsModule {}
