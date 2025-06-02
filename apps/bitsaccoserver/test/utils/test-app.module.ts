import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// Test database module
import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Global()
@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/bitsacco-test', {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      retryWrites: true,
      retryReads: true,
    }),
  ],
  exports: [MongooseModule],
})
class TestDatabaseModule {}

// Test monitoring module
import { MetricsService } from '../../src/infrastructure/monitoring/metrics.service';
import { BusinessMetricsService } from '../../src/infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../src/infrastructure/monitoring/telemetry.service';

// Create mock monitoring services to avoid metric registry conflicts
const mockMetricsService = {
  incrementHttpRequests: () => {},
  recordHttpRequestDuration: () => {},
  incrementWebSocketConnections: () => {},
  decrementWebSocketConnections: () => {},
  recordDatabaseQuery: () => {},
  recordCacheHit: () => {},
  recordCacheMiss: () => {},
  getHealthMetrics: () => Promise.resolve({}),
  recordMemoryUsage: () => {},
  recordCpuUsage: () => {},
  register: { metrics: () => Promise.resolve('') },
};

const mockBusinessMetricsService = {
  recordTokenOperation: () => Promise.resolve(),
  recordDomainError: () => Promise.resolve(),
  recordOperationDuration: () => Promise.resolve(),
  recordCommunicationMetric: () => Promise.resolve(),
  recordUserRegistration: () => Promise.resolve(),
  recordUserLogin: () => Promise.resolve(),
  recordApiCall: () => Promise.resolve(),
  recordAuthEvent: () => Promise.resolve(),
};

const mockTelemetryService = {
  executeWithSpan: async (name: string, fn: Function) => fn(),
  recordEvent: () => {},
};

@Global()
@Module({
  providers: [
    { provide: MetricsService, useValue: mockMetricsService },
    { provide: BusinessMetricsService, useValue: mockBusinessMetricsService },
    { provide: TelemetryService, useValue: mockTelemetryService },
  ],
  exports: [MetricsService, BusinessMetricsService, TelemetryService],
})
class TestMonitoringModule {}

// Infrastructure modules
import { SecurityModule } from '../../src/infrastructure/security/security.module';
import { MessagingModule } from '../../src/infrastructure/messaging/messaging.module';

// Test REST API module with minimal dependencies
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from '../../src/api/rest/controllers/auth.controller';
import { ResponseInterceptor } from '../../src/api/rest/interceptors/response.interceptor';
import { MetricsInterceptor } from '../../src/api/rest/interceptors/metrics.interceptor';
import { AuthDomainModule } from '../../src/domains/auth/auth-domain.module';

@Module({
  imports: [
    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 200,
      },
    ]),
    // Import AuthDomainModule for controller dependencies
    AuthDomainModule,
  ],
  controllers: [AuthController],
  providers: [ResponseInterceptor, MetricsInterceptor],
  exports: [ResponseInterceptor, MetricsInterceptor],
})
class TestRestApiModule {}

// Test health controller without GRPC dependencies
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
class TestHealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check() {
    return {
      status: 'ok',
      info: {
        database: { status: 'up' },
        'swap-service': { status: 'up' },
        redis: { status: 'up' },
        memory: { status: 'up' },
      },
      error: {},
      details: {
        database: { status: 'up' },
        'swap-service': { status: 'up' },
        redis: { status: 'up' },
        memory: { status: 'up' },
      },
    };
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with metrics' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  async detailedCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0-test',
      environment: 'test',
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  async readiness() {
    return {
      status: 'ok',
      message: 'Service is ready',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async liveness() {
    return {
      status: 'ok',
      message: 'Service is alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env', '.env.local'],
      expandVariables: true,
    }),

    // Event system
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Health checks
    TerminusModule,

    // Infrastructure
    TestDatabaseModule,
    TestMonitoringModule,
    SecurityModule,
    MessagingModule,

    // API layers (minimal for auth tests)
    TestRestApiModule,

    // Domain modules (only essential ones for auth tests)
    AuthDomainModule,
  ],
  controllers: [TestHealthController],
  providers: [
    // Mock SWAP_SERVICE for tests
    {
      provide: 'SWAP_SERVICE',
      useValue: {
        getService: () => ({
          createSwap: () => Promise.resolve({ success: true }),
          getSwap: () => Promise.resolve({ success: true }),
          listSwaps: () =>
            Promise.resolve({ success: true, swaps: [], total: 0 }),
          getExchangeRate: () => Promise.resolve({ success: true, rate: 1 }),
          cancelSwap: () => Promise.resolve({ success: true }),
        }),
      },
    },
  ],
})
export class TestAppModule {}
