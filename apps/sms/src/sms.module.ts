import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule, RedisProvider } from '@bitsacco/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsMetricsService } from './sms.metrics';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        SMS_GRPC_URL: Joi.string().required(),
        SMS_AT_API_KEY: Joi.string().required(),
        SMS_AT_USERNAME: Joi.string().required(),
        SMS_AT_FROM: Joi.string().required(),
        SMS_AT_KEYWORD: Joi.string().required(),
      }),
    }),
    LoggerModule,
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
  ],
  controllers: [SmsController],
  providers: [SmsService, ConfigService, SmsMetricsService, RedisProvider],
})
export class SmsModule {}
