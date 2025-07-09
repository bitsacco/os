import * as Joi from 'joi';
import { join } from 'path';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  CHAMA_WALLET_SERVICE_NAME,
  CHAMAS_SERVICE_NAME,
  DatabaseModule,
  EVENTS_SERVICE_BUS,
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
  ServiceRegistryService,
  SecretsService,
  JwtAuthGuard,
  DistributedRateLimitService,
  RedisProvider,
  getRedisConfig,
  RoleValidationService,
  CoreMetricsService,
  GlobalExceptionFilter,
  CircuitBreakerService,
  GrpcSessionRetryInterceptor,
  GrpcConnectionManager,
  GrpcServiceWrapper,
} from '@bitsacco/common';
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
    JwtModule,
    LoggerModule,
    MetricsModule,
    SmsModule,
    SharesModule,
    NostrModule,
    NotificationModule,
    AuthModule,
    SwapModule,
    SolowalletModule,
    ChamaModule,
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.string().required(),
        NODE_ENV: Joi.string().required(),
        CHAMA_GRPC_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PASSWORD: Joi.string().required(),
        REDIS_TLS: Joi.boolean().default(false),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
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
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useClass: ThrottlerConfigService,
    }),
    ClientsModule.registerAsync([
      {
        name: EVENTS_SERVICE_BUS,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: getRedisConfig(configService),
        }),
        inject: [ConfigService],
      },
    ]),
    DatabaseModule,
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
    // Global gRPC session retry interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: GrpcSessionRetryInterceptor,
    },
    CircuitBreakerService,
    CoreMetricsService,
    RedisProvider,
    UsersRepository,
    UsersService,
    PhoneAuthStategy,
    NpubAuthStategy,
    JwtAuthStrategy,
    ApiKeyRepository,
    ApiKeyService,
    ApiKeyGuard,
    SecretsService,
    ServiceRegistryService,
    CombinedAuthGuard,
    JwtAuthGuard,
    Reflector,
    DistributedRateLimitService,
    RoleValidationService,
    GrpcConnectionManager,
    GrpcServiceWrapper,
  ],
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
