import { join } from 'path';
import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  EVENTS_SERVICE_BUS,
  LoggerModule,
  NOSTR_PACKAGE_NAME,
  NOSTR_SERVICE_NAME,
  SWAP_PACKAGE_NAME,
  SWAP_SERVICE_NAME,
} from '@bitsacco/common';
import { SwapController, SwapService } from './swap';
import { NostrController, NostrService } from './nostr';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.string().required(),
        NODE_ENV: Joi.string().required(),
        SWAP_GRPC_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: SWAP_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: SWAP_PACKAGE_NAME,
            protoPath: join(__dirname, '../../../proto/swap.proto'),
            url: configService.getOrThrow<string>('SWAP_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: NOSTR_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: NOSTR_PACKAGE_NAME,
            protoPath: join(__dirname, '../../../proto/nostr.proto'),
            url: configService.getOrThrow<string>('NOSTR_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: EVENTS_SERVICE_BUS,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: {
            host: configService.getOrThrow<string>('REDIS_HOST'),
            port: configService.getOrThrow<number>('REDIS_PORT'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [SwapController, NostrController],
  providers: [SwapService, NostrService],
})
export class ApiModule {}
