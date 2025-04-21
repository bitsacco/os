import * as Joi from 'joi';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  DatabaseModule,
  LoggerModule,
  SMS_SERVICE_NAME,
  UsersDocument,
  UsersRepository,
  UsersSchema,
  UsersService,
  TokenDocument,
  TokenSchema,
  TokenRepository,
} from '@bitsacco/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './tokens/token.service';
import { AuthMetricsService } from './metrics/auth.metrics';
import { TokenMetricsService } from './tokens/token.metrics';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        AUTH_GRPC_URL: Joi.string().required(),
        SMS_GRPC_URL: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        AUTH_JWT_SECRET: Joi.string().min(32).required().description('JWT secret must be at least 32 characters for security'),
        AUTH_JWT_EXPIRATION: Joi.string().required(),
        AUTH_JWT_AUD: Joi.string().required(),
        AUTH_JWT_ISS: Joi.string().required(),
        REFRESH_TOKEN_EXPIRATION_DAYS: Joi.number().default(7),
        SALT_ROUNDS: Joi.number().required(),
      }),
    }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('AUTH_JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.getOrThrow('AUTH_JWT_EXPIRATION')}s`,
        },
      }),
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync([
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
    ]),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: UsersDocument.name, schema: UsersSchema },
      { name: TokenDocument.name, schema: TokenSchema },
    ]),
    LoggerModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [
    AuthMetricsService,
    TokenMetricsService,
    AuthService,
    UsersRepository,
    UsersService,
    ConfigService,
    TokenRepository,
    TokenService,
    AuthMetricsService,
    TokenMetricsService,
  ],
})
export class AuthModule {}
