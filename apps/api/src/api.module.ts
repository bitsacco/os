import * as Joi from 'joi';
import { join } from 'path';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport, GrpcOptions } from '@nestjs/microservices';
import { ChannelOptions } from '@grpc/grpc-js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  AUTH_SERVICE_NAME,
  CHAMA_WALLET_SERVICE_NAME,
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
  createMeter,
  NOTIFICATION_SERVICE_NAME,
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
} from '@bitsacco/common';
import { ApiKeyMiddleware } from './middleware/api-key.middleware';
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { IpRateLimitMiddleware } from './middleware/ip-rate-limit.middleware';
import { ThrottlerConfigService } from './middleware/throttler.config';
import { CombinedAuthGuard } from './auth/combined-auth.guard';
import { SwapController } from './swap';
import { NostrController } from './nostr';
import { SmsController } from './sms/sms.controller';
import { SharesController } from './shares/shares.controller';
import { SolowalletController } from './solowallet/solowallet.controller';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { ChamasController } from './chamas/chamas.controller';
import { NotificationGateway } from './notifications/notification.gateway';
import { NotificationController } from './notifications/notification.controller';
import { HealthController } from './health/health.controller';

// Import the metrics module
import { MetricsModule } from './metrics/metrics.module';

// Helper function to create gRPC options with HTTP/2 stability fixes
function createGrpcOptions(
  packageName: string,
  protoPath: string,
  url: string,
): GrpcOptions['options'] {
  const channelOptions: ChannelOptions = {
    // Keepalive settings to prevent connection issues
    'grpc.keepalive_time_ms': 120000, // 2 minutes
    'grpc.keepalive_timeout_ms': 20000, // 20 seconds
    'grpc.keepalive_permit_without_calls': 1,

    // HTTP/2 settings to prevent stack overflow
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_time_between_pings_ms': 120000,
    'grpc.http2.max_ping_strikes': 0,

    // Message size limits
    'grpc.max_receive_message_length': -1, // unlimited
    'grpc.max_send_message_length': -1, // unlimited

    // Connection management
    'grpc.initial_reconnect_backoff_ms': 1000,
    'grpc.max_reconnect_backoff_ms': 10000,
    'grpc.enable_retries': 1,

    // Disable aggressive HTTP/2 optimizations that might cause issues
    'grpc.use_local_subchannel_pool': 0,

    // Channel args to improve stability
    'grpc.client_idle_timeout_ms': 300000, // 5 minutes
    'grpc.max_connection_idle_ms': 300000, // 5 minutes
    'grpc.max_connection_age_ms': 600000, // 10 minutes
    'grpc.max_connection_age_grace_ms': 10000, // 10 seconds grace period
  };

  return {
    package: packageName,
    protoPath,
    url,
    channelOptions,
    // Loader options for better compatibility
    loader: {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
  };
}

@Module({
  imports: [
    JwtModule,
    LoggerModule,
    MetricsModule,
    EventEmitterModule.forRoot(),
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
        NOTIFICATION_GRPC_URL: Joi.string().required(),
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
        name: AUTH_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: createGrpcOptions(
            'auth',
            join(__dirname, '../../../proto/auth.proto'),
            configService.getOrThrow<string>('AUTH_GRPC_URL'),
          ),
        }),
        inject: [ConfigService],
      },
      {
        name: SWAP_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: createGrpcOptions(
            'swap',
            join(__dirname, '../../../proto/swap.proto'),
            configService.getOrThrow<string>('SWAP_GRPC_URL'),
          ),
        }),
        inject: [ConfigService],
      },
      {
        name: NOSTR_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: createGrpcOptions(
            'nostr',
            join(__dirname, '../../../proto/nostr.proto'),
            configService.getOrThrow<string>('NOSTR_GRPC_URL'),
          ),
        }),
        inject: [ConfigService],
      },
      {
        name: SMS_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: createGrpcOptions(
            'sms',
            join(__dirname, '../../../proto/sms.proto'),
            configService.getOrThrow<string>('SMS_GRPC_URL'),
          ),
        }),
        inject: [ConfigService],
      },
      {
        name: SHARES_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: createGrpcOptions(
            'shares',
            join(__dirname, '../../../proto/shares.proto'),
            configService.getOrThrow<string>('SHARES_GRPC_URL'),
          ),
        }),
        inject: [ConfigService],
      },
      {
        name: SOLOWALLET_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: createGrpcOptions(
            'solowallet',
            join(__dirname, '../../../proto/solowallet.proto'),
            configService.getOrThrow<string>('SOLOWALLET_GRPC_URL'),
          ),
        }),
        inject: [ConfigService],
      },
      {
        name: CHAMAS_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: createGrpcOptions(
            'chama',
            join(__dirname, '../../../proto/chama.proto'),
            configService.getOrThrow<string>('CHAMA_GRPC_URL'),
          ),
        }),
        inject: [ConfigService],
      },
      {
        name: CHAMA_WALLET_SERVICE_NAME,
        useFactory: (configService: ConfigService) => {
          const options = createGrpcOptions(
            'chamawallet',
            join(__dirname, '../../../proto/chamawallet.proto'),
            configService.getOrThrow<string>('CHAMA_GRPC_URL'),
          );
          // Handle array protoPath case
          options.protoPath = [options.protoPath as string];
          return {
            transport: Transport.GRPC,
            options,
          };
        },
        inject: [ConfigService],
      },
      {
        name: NOTIFICATION_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: createGrpcOptions(
            'notification',
            join(__dirname, '../../../proto/notification.proto'),
            configService.getOrThrow<string>('NOTIFICATION_GRPC_URL'),
          ),
        }),
        inject: [ConfigService],
      },
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
  controllers: [
    AuthController,
    UsersController,
    SwapController,
    NostrController,
    SmsController,
    SharesController,
    SolowalletController,
    ChamasController,
    NotificationController,
    HealthController,
  ],
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
    CircuitBreakerService,
    CoreMetricsService,
    RedisProvider,
    UsersRepository,
    UsersService,
    PhoneAuthStategy,
    NpubAuthStategy,
    JwtAuthStrategy,
    NotificationGateway,
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
