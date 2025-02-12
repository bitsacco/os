import * as Joi from 'joi';
import { join } from 'path';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  AUTH_SERVICE_NAME,
  CHAMAS_SERVICE_NAME,
  DatabaseModule,
  EVENTS_SERVICE_BUS,
  JwtAuthStrategy,
  LoggerModule,
  NOSTR_SERVICE_NAME,
  NpubAuthStategy,
  PhoneAuthStategy,
  SHARES_SERVICE_NAME,
  SMS_SERVICE_NAME,
  SOLOWALLET_SERVICE_NAME,
  SWAP_SERVICE_NAME,
  UsersDocument,
  UsersRepository,
  UsersSchema,
  UsersService,
} from '@bitsacco/common';
import { SwapController, SwapService } from './swap';
import { NostrController, NostrService } from './nostr';
import { SmsService } from './sms/sms.service';
import { SmsController } from './sms/sms.controller';
import { SharesService } from './shares/shares.service';
import { SharesController } from './shares/shares.controller';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { SolowalletService } from './solowallet/solowallet.service';
import { SolowalletController } from './solowallet/solowallet.controller';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { ChamasController } from './chamas/chamas.controller';

@Module({
  imports: [
    JwtModule,
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.string().required(),
        NODE_ENV: Joi.string().required(),
        AUTH_GRPC_URL: Joi.string().required(),
        SWAP_GRPC_URL: Joi.string().required(),
        NOSTR_GRPC_URL: Joi.string().required(),
        SMS_GRPC_URL: Joi.string().required(),
        SHARES_GRPC_URL: Joi.string().required(),
        SOLOWALLET_GRPC_URL: Joi.string().required(),
        CHAMA_GRPC_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'auth',
            protoPath: join(__dirname, '../../../proto/auth.proto'),
            url: configService.getOrThrow<string>('AUTH_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: SWAP_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'swap',
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
            package: 'nostr',
            protoPath: join(__dirname, '../../../proto/nostr.proto'),
            url: configService.getOrThrow<string>('NOSTR_GRPC_URL'),
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
            protoPath: join(__dirname, '../../../proto/sms.proto'),
            url: configService.getOrThrow<string>('SMS_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: SHARES_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'shares',
            protoPath: join(__dirname, '../../../proto/shares.proto'),
            url: configService.getOrThrow<string>('SHARES_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: SOLOWALLET_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'solowallet',
            protoPath: join(__dirname, '../../../proto/solowallet.proto'),
            url: configService.getOrThrow<string>('SOLOWALLET_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: CHAMAS_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'chama',
            protoPath: join(__dirname, '../../../proto/chama.proto'),
            url: configService.getOrThrow<string>('CHAMA_GRPC_URL'),
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
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: UsersDocument.name, schema: UsersSchema },
    ]),
  ],
  controllers: [
    AuthController,
    SwapController,
    NostrController,
    SmsController,
    SharesController,
    SolowalletController,
    AdminController,
    UsersController,
    ChamasController,
  ],
  providers: [
    AuthService,
    UsersRepository,
    UsersService,
    SwapService,
    NostrService,
    SmsService,
    SharesService,
    SolowalletService,
    AdminService,
    PhoneAuthStategy,
    NpubAuthStategy,
    JwtAuthStrategy,
  ],
})
export class ApiModule {}
