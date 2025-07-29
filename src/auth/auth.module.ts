import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import {
  DatabaseModule,
  LoggerModule,
  UsersDocument,
  UsersRepository,
  UsersSchema,
  UsersService,
  TokenDocument,
  TokenSchema,
  TokenRepository,
  ApiKeyDocument,
  ApiKeySchema,
  ApiKeyRepository,
  ApiKeyService,
  SecretsService,
  RoleValidationService,
} from '../common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './tokens/token.service';
import { AuthMetricsService } from './metrics/auth.metrics';
import { TokenMetricsService } from './tokens/token.metrics';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { ApiKeyController } from './apikeys/apikey.controller';
import { ApiKeyMetricsService } from './apikeys/apikey.metrics';
import { SmsModule } from '../sms/sms.module';
import { JwtConfigModule } from '../common/jwt-config.module';
import { SharedModule } from '../common/shared.module';

@Module({
  imports: [
    SharedModule,
    SmsModule,
    JwtConfigModule.forRoot({
      secretKey: 'AUTH_JWT_SECRET',
      expirationKey: 'AUTH_JWT_EXPIRATION',
    }),
    DatabaseModule.forFeature([
      { name: UsersDocument.name, schema: UsersSchema },
      { name: TokenDocument.name, schema: TokenSchema },
      { name: ApiKeyDocument.name, schema: ApiKeySchema },
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AuthController, ApiKeyController],
  providers: [
    AuthMetricsService,
    TokenMetricsService,
    ApiKeyMetricsService,
    AuthService,
    UsersRepository,
    UsersService,
    ConfigService,
    TokenRepository,
    TokenService,
    RateLimitService,
    ApiKeyRepository,
    ApiKeyService,
    SecretsService,
    RoleValidationService,
  ],
})
export class AuthModule {}
