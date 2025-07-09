import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  LoggerModule,
  RedisProvider,
  RoleValidationService,
} from '@bitsacco/common';
import { NostrController } from './nostr.controller';
import { NostrService } from './nostr.service';
import { NostrMetricsService } from './nostr.metrics';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NOSTR_PUBLIC_KEY: Joi.string().required(),
        NOSTR_PRIVATE_KEY: Joi.string().required(),
      }),
    }),
    LoggerModule,
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
  ],
  controllers: [NostrController],
  providers: [
    NostrService,
    ConfigService,
    NostrMetricsService,
    RedisProvider,
    RoleValidationService,
  ],
})
export class NostrModule {}
