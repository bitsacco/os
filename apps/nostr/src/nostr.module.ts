import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@bitsacco/common';
import { NostrController } from './nostr.controller';
import { NostrService } from './nostr.service';

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
  ],
  controllers: [NostrController],
  providers: [NostrService, ConfigService],
})
export class NostrModule {}
