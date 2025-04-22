import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule, RedisProvider } from '@bitsacco/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NostrController } from './nostr.controller';
import { NostrService } from './nostr.service';
import { NostrMetricsService } from './nostr.metrics';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        NOSTR_GRPC_URL: Joi.string().required(),
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
  providers: [NostrService, ConfigService, NostrMetricsService, RedisProvider],
})
export class NostrModule {}
