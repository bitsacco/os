import * as Joi from 'joi';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  DatabaseModule,
  JwtAuthStrategy,
  LoggerModule,
  NpubAuthStategy,
  PhoneAuthStategy,
  UsersDocument,
  UsersRepository,
  UsersSchema,
  UsersService,
  ApiKeyDocument,
  ApiKeySchema,
  ApiKeyRepository,
  ApiKeyService,
  ApiKeyGuard,
  SecretsService,
  JwtAuthGuard,
  RoleValidationService,
  CoreMetricsService,
  GlobalExceptionFilter,
  SharedModule,
} from './common';
import { ApiKeyMiddleware } from './middleware/api-key.middleware';
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { IpRateLimitMiddleware } from './middleware/ip-rate-limit.middleware';
import { ThrottlerConfigService } from './middleware/throttler.config';
import { CombinedAuthGuard } from './auth/combined-auth.guard';
import { SolowalletModule } from './solowallet/solowallet.module';
import { UsersController } from './users/users.controller';
import { ChamasController } from './chamas/chamas.controller';
import { HealthController } from './health/health.controller';
import { SmsModule } from './sms/sms.module';
import { SharesModule } from './shares/shares.module';
import { NostrModule } from './nostr/nostr.module';
import { NotificationModule } from './notifications/notification.module';
import { AuthModule } from './auth/auth.module';
import { SwapModule } from './swap/swap.module';
import { ChamaModule } from './chamas/chama.module';

// Import the metrics module
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    // Global configuration modules
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.string().required(),
        NODE_ENV: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().required(),
        THROTTLE_TTL: Joi.number().default(60),
        THROTTLE_LIMIT: Joi.number().default(120),
        IP_RATE_LIMIT_ENABLED: Joi.boolean().default(true),
        IP_RATE_LIMIT: Joi.number().default(30),
        IP_RATE_LIMIT_WINDOW: Joi.number().default(60),
        IP_RATE_LIMIT_BURST: Joi.number().default(10),
        IP_RATE_LIMIT_TRUSTED: Joi.string().default(''),
        CSP_REPORT_URI: Joi.string().optional(),
        DOCS_API_KEY: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().required(),
          otherwise: Joi.optional(),
        }),
        // Auth module
        AUTH_JWT_SECRET: Joi.string()
          .min(32)
          .required()
          .description(
            'JWT secret must be at least 32 characters for security',
          ),
        AUTH_JWT_EXPIRATION: Joi.string().required(),
        AUTH_JWT_AUD: Joi.string().required(),
        AUTH_JWT_ISS: Joi.string().required(),
        REFRESH_TOKEN_EXPIRATION_DAYS: Joi.number().default(7),
        SALT_ROUNDS: Joi.number().required(),
        API_KEY_SALT: Joi.string()
          .min(16)
          .default('bitsacco-api-salt')
          .description(
            'Salt for hashing API keys. Should be at least 16 characters',
          ),
        // SMS module
        SMS_AT_API_KEY: Joi.string().required(),
        SMS_AT_USERNAME: Joi.string().required(),
        SMS_AT_FROM: Joi.string().required(),
        SMS_AT_KEYWORD: Joi.string().required(),
        // Nostr module
        NOSTR_PUBLIC_KEY: Joi.string().required(),
        NOSTR_PRIVATE_KEY: Joi.string().required(),
        // Solowallet module
        SOLOWALLET_CLIENTD_BASE_URL: Joi.string().required(),
        SOLOWALLET_CLIENTD_PASSWORD: Joi.string().required(),
        SOLOWALLET_FEDERATION_ID: Joi.string().required(),
        SOLOWALLET_GATEWAY_ID: Joi.string().required(),
        SOLOWALLET_LNURL_CALLBACK: Joi.string().required(),
        // Swap module
        MOCK_BTC_KES_RATE: Joi.number(),
        CURRENCY_API_KEY: Joi.string(),
        INTASEND_PUBLIC_KEY: Joi.string().required(),
        INTASEND_PRIVATE_KEY: Joi.string().required(),
        SWAP_CLIENTD_BASE_URL: Joi.string().required(),
        SWAP_CLIENTD_PASSWORD: Joi.string().required(),
        SWAP_FEDERATION_ID: Joi.string().required(),
        SWAP_GATEWAY_ID: Joi.string().required(),
        // Chama module
        CHAMA_CLIENTD_BASE_URL: Joi.string().required(),
        CHAMA_CLIENTD_PASSWORD: Joi.string().required(),
        CHAMA_FEDERATION_ID: Joi.string().required(),
        CHAMA_GATEWAY_ID: Joi.string().required(),
        CHAMA_EXPERIENCE_URL: Joi.string().required(),
        CHAMA_LNURL_CALLBACK: Joi.string().required(),
        BITLY_TOKEN: Joi.string().required(),
      }),
    }),
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
    SharedModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.getOrThrow('JWT_EXPIRATION')}s`,
        },
      }),
      inject: [ConfigService],
    }),
    // Core modules
    MetricsModule,
    // Feature modules
    SmsModule,
    SharesModule,
    NostrModule,
    NotificationModule,
    AuthModule,
    SwapModule,
    SolowalletModule,
    ChamaModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useClass: ThrottlerConfigService,
    }),
    DatabaseModule.forFeature([
      { name: UsersDocument.name, schema: UsersSchema },
      { name: ApiKeyDocument.name, schema: ApiKeySchema },
    ]),
  ],
  controllers: [UsersController, ChamasController, HealthController],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useFactory: (metricsService: CoreMetricsService) => {
        return new GlobalExceptionFilter(metricsService);
      },
      inject: [CoreMetricsService],
    },
    CoreMetricsService,
    UsersRepository,
    UsersService,
    PhoneAuthStategy,
    NpubAuthStategy,
    JwtAuthStrategy,
    ApiKeyRepository,
    ApiKeyService,
    ApiKeyGuard,
    SecretsService,
    CombinedAuthGuard,
    JwtAuthGuard,
    Reflector,
    RoleValidationService,
  ],
  exports: [JwtModule],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply global middlewares in order:
    // 1. Security headers - sets secure headers for all responses
    // 2. IP rate limiting - protects against DDoS and brute force from anonymous clients
    // 3. API key middleware - validates API keys in requests
    consumer
      .apply(SecurityHeadersMiddleware, IpRateLimitMiddleware, ApiKeyMiddleware)
      .forRoutes('*');
  }
}
