import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import {
  DatabaseModule,
  EVENTS_SERVICE_BUS,
  FedimintService,
  getRedisConfig,
  LoggerModule,
  RedisProvider,
  RoleValidationService,
  UsersDocument,
  UsersRepository,
  UsersSchema,
  UsersService,
  LnurlMetricsService,
  SMS_SERVICE_NAME,
  SWAP_SERVICE_NAME,
} from '@bitsacco/common';
import { ChamasService } from '../chamas/chamas.service';
import { ChamaWalletService } from '../chamawallet/wallet.service';
import { ChamaMetricsService } from '../chamas/chama.metrics';
import { SwapModule } from '../swap/swap.module';
import { ChamasDocument, ChamasRepository, ChamasSchema } from '../chamas/db';
import {
  ChamaWalletDocument,
  ChamaWalletRepository,
  ChamaWalletSchema,
} from '../chamawallet/db';
import { ChamaMessageService } from './chamas.messaging';
import { join } from 'path';
import { CacheModule } from '@nestjs/cache-manager';
import { configRedisCacheStore } from '@bitsacco/common';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        FEDIMINT_CLIENTD_BASE_URL: Joi.string().required(),
        FEDIMINT_CLIENTD_PASSWORD: Joi.string().required(),
        FEDIMINT_FEDERATION_ID: Joi.string().required(),
        FEDIMINT_GATEWAY_ID: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PASSWORD: Joi.string().required(),
        REDIS_TLS: Joi.boolean().default(false),
        SMS_AT_API_KEY: Joi.string().required(),
        SMS_AT_USERNAME: Joi.string().required(),
        SMS_AT_FROM: Joi.string().required(),
        SMS_AT_KEYWORD: Joi.string().required(),
        CHAMA_GRPC_URL: Joi.string().required(),
        SWAP_GRPC_URL: Joi.string().required(),
        SMS_GRPC_URL: Joi.string().required(),
        CHAMA_EXPERIENCE_URL: Joi.string().required(),
        LNURL_CALLBACK: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().required(),
        BITLY_TOKEN: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: ChamasDocument.name, schema: ChamasSchema },
      { name: ChamaWalletDocument.name, schema: ChamaWalletSchema },
      { name: UsersDocument.name, schema: UsersSchema },
    ]),
    LoggerModule,
    SwapModule,
    ClientsModule.registerAsync([
      {
        name: EVENTS_SERVICE_BUS,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: getRedisConfig(configService),
        }),
        inject: [ConfigService],
      },
      {
        name: SWAP_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'swap',
            protoPath: join(__dirname, '../../../../proto/swap.proto'),
            url: configService.getOrThrow<string>('SWAP_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: SMS_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'sms',
            protoPath: join(__dirname, '../../../../proto/sms.proto'),
            url: configService.getOrThrow<string>('SMS_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
    HttpModule,
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const ttl = 60 * 60 * 5; // 5 hours
        return configRedisCacheStore(configService, ttl);
      },
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.getOrThrow('JWT_EXPIRATION')}s`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    ChamasService,
    ChamaWalletService,
    ConfigService,
    ChamasRepository,
    ChamaWalletRepository,
    FedimintService,
    ChamaMetricsService,
    RedisProvider,
    RoleValidationService,
    ChamaMessageService,
    UsersService,
    UsersRepository,
    LnurlMetricsService,
  ],
  exports: [ChamasService, ChamaWalletService],
})
export class ChamaModule {}
