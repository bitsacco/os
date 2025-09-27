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
  TelemetryModule,
} from './common';
import { TimeoutModule } from './common/timeout/timeout.module';
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
import { LnurlModule } from './lnurl/lnurl.module';
import { PersonalModule } from './personal/personal.module';

// Import the metrics module
import { MetricsModule } from './metrics/metrics.module';
// Import the dashboard module
import { DashboardModule } from './dashboard/dashboard.module';

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
        THROTTLE_TTL: Joi.number().optional().default(60),
        THROTTLE_LIMIT: Joi.number().optional().default(1000),
        IP_RATE_LIMIT_ENABLED: Joi.boolean().optional().default(true),
        IP_RATE_LIMIT: Joi.number().optional().default(30),
        IP_RATE_LIMIT_WINDOW: Joi.number().optional().default(60),
        IP_RATE_LIMIT_BURST: Joi.number().optional().default(10),
        IP_RATE_LIMIT_TRUSTED: Joi.string().optional().default(''),
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
        // LNURL module
        LNURL_DOMAIN: Joi.string().default('bitsacco.com'),
        LNURL_CALLBACK_BASE_URL: Joi.string().required(),
        LNURL_MAX_SENDABLE_MSATS: Joi.number()
          .default(10_000_000_000_000)
          .description(
            'Maximum receivable amount in millisatoshis (default: 0.1 BTC)',
          ),
        // Fedimint Service Configuration (for LNURL module)
        CLIENTD_BASE_URL: Joi.string().required(),
        CLIENTD_PASSWORD: Joi.string().required(),
        FEDERATION_ID: Joi.string().required(),
        GATEWAY_ID: Joi.string().required(),
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
        CHAMA_EXPERIENCE_URL: Joi.string().required(),
        BITLY_TOKEN: Joi.string().required(),
        // Transaction timeout configuration
        TX_TIMEOUT_PENDING_MINUTES: Joi.number()
          .min(1)
          .max(60)
          .default(15)
          .description(
            'Time before PENDING transactions are considered stuck (1-60 minutes)',
          ),
        TX_TIMEOUT_PROCESSING_MINUTES: Joi.number()
          .min(5)
          .max(120)
          .default(30)
          .description(
            'Time before PROCESSING transactions are considered stuck (5-120 minutes)',
          ),
        TX_TIMEOUT_MAX_RETRIES: Joi.number()
          .min(1)
          .max(10)
          .default(3)
          .description('Maximum retry attempts for stuck transactions (1-10)'),
        TX_TIMEOUT_CHECK_INTERVAL_SECONDS: Joi.number()
          .min(30)
          .max(300)
          .default(60)
          .description(
            'How often to check for stuck transactions (30-300 seconds)',
          ),
        TX_TIMEOUT_DEPOSIT_MINUTES: Joi.number()
          .min(1)
          .max(60)
          .default(15)
          .description(
            'Specific timeout for deposit transactions (1-60 minutes)',
          ),
        TX_TIMEOUT_WITHDRAWAL_MINUTES: Joi.number()
          .min(5)
          .max(120)
          .default(30)
          .description(
            'Specific timeout for withdrawal transactions (5-120 minutes)',
          ),
        TX_TIMEOUT_LNURL_MINUTES: Joi.number()
          .min(5)
          .max(60)
          .default(30)
          .description(
            'Specific timeout for LNURL withdrawal requests (5-60 minutes)',
          ),
        TX_TIMEOUT_OFFRAMP_MINUTES: Joi.number()
          .min(1)
          .max(60)
          .default(15)
          .description(
            'Specific timeout for offramp transactions (1-60 minutes)',
          ),
      }),
    }),
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
    SharedModule,
    TelemetryModule,
    TimeoutModule,
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
    DashboardModule,
    // Feature modules
    SmsModule,
    SharesModule,
    NostrModule,
    NotificationModule,
    AuthModule,
    SwapModule,
    SolowalletModule,
    PersonalModule,
    ChamaModule,
    LnurlModule,
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
