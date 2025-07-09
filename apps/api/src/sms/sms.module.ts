import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '@bitsacco/common';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsMetricsService } from './sms.metrics';
import { JwtConfigModule } from '../shared/jwt-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        SMS_AT_API_KEY: Joi.string().required(),
        SMS_AT_USERNAME: Joi.string().required(),
        SMS_AT_FROM: Joi.string().required(),
        SMS_AT_KEYWORD: Joi.string().required(),
      }),
    }),
    LoggerModule,
    JwtConfigModule.forRoot(),
  ],
  controllers: [SmsController],
  providers: [SmsService, SmsMetricsService],
  exports: [SmsService, SmsMetricsService],
})
export class SmsModule {}
