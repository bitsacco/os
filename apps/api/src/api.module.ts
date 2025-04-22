import axios from 'axios';
import * as Joi from 'joi';
import { join } from 'path';
import { register } from 'prom-client';
import {
  Module,
  Controller,
  Get,
  MiddlewareConsumer,
  NestModule,
  APP_GUARD,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
} from '@bitsacco/common';
import { ApiKeyMiddleware } from './middleware/api-key.middleware';
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
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

// Controller for federated metrics
@Controller('metrics')
export class MetricsController {
  private readonly serviceEndpoints = {
    shares: process.env.SHARES_GRPC_URL,
    chama: process.env.CHAMA_GRPC_URL,
    solowallet: process.env.SOLOWALLET_GRPC_URL,
    swap: process.env.SWAP_GRPC_URL,
    auth: process.env.AUTH_GRPC_URL,
    sms: process.env.SMS_GRPC_URL,
    nostr: process.env.NOSTR_GRPC_URL,
  };

  constructor() {
    // Initialize metrics specific to API gateway
    const meter = createMeter('api-gateway');

    meter.createCounter('api_gateway.requests_total', {
      description: 'Total number of requests processed by the API gateway',
    });

    meter.createCounter('api_gateway.errors_total', {
      description: 'Total number of errors encountered by the API gateway',
    });
  }

  @Get()
  async getMetrics() {
    try {
      // First, get metrics from API gateway itself
      const ownMetrics = await register.metrics();
      let combinedMetrics = ownMetrics;

      // Collect metrics from individual services
      for (const [service, url] of Object.entries(this.serviceEndpoints)) {
        if (!url) continue;

        try {
          // Extract hostname/port from gRPC URL format like "hostname:port"
          const [host, port] = url.split(':');
          if (!host || !port) continue;

          const metricsUrl = `http://${host}:${port}/metrics`;
          const response = await axios.get(metricsUrl, { timeout: 500 });

          if (response.status === 200) {
            // Add service metrics to combined output
            combinedMetrics += `\n# Metrics from ${service} service\n${response.data}`;
          }
        } catch (err) {
          // Skip services that don't have metrics endpoints available
          console.log(
            `Could not fetch metrics from ${service}: ${err.message}`,
          );
        }
      }

      return combinedMetrics;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return 'Error fetching metrics';
    }
  }
}

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
        NOTIFICATION_GRPC_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        THROTTLE_TTL: Joi.number().default(60),
        THROTTLE_LIMIT: Joi.number().default(120),
        REDIS_PASSWORD: Joi.string().default('securepassword'),
        REDIS_TLS: Joi.boolean().default(false),
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
        name: CHAMA_WALLET_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'chamawallet',
            protoPath: [join(__dirname, '../../../proto/chamawallet.proto')],
            url: configService.getOrThrow<string>('CHAMA_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: NOTIFICATION_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'notification',
            protoPath: join(__dirname, '../../../proto/notification.proto'),
            url: configService.getOrThrow<string>('NOTIFICATION_GRPC_URL'),
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
            password: configService.get<string>('REDIS_PASSWORD'),
            tls: configService.get<boolean>('REDIS_TLS', false) ? {} : undefined,
          },
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
    MetricsController,
    NotificationController,
    HealthController,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
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
  ],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply global middlewares
    consumer
      .apply(SecurityHeadersMiddleware, ApiKeyMiddleware)
      .forRoutes('*');
  }
}