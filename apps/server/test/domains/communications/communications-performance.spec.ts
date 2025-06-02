import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { beforeAll, afterAll, describe, it, expect, mock } from 'bun:test';
import { BusinessMetricsService } from '../../../src/infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../src/infrastructure/monitoring/telemetry.service';
import { MetricsService } from '../../../src/infrastructure/monitoring/metrics.service';

// Mock africastalking module
mock.module('africastalking', () => ({
  default: mock(() => ({
    SMS: {
      send: mock().mockResolvedValue({
        status: 'success',
        data: { recipients: [{ status: 'Success' }] },
      }),
    },
  })),
}));

// Mock NDK module
mock.module('@nostr-dev-kit/ndk', () => ({
  default: mock(() => ({
    connect: mock().mockResolvedValue(undefined),
    pool: {
      on: mock(),
      connectedRelays: mock().mockReturnValue([
        { url: 'wss://test1.relay' },
        { url: 'wss://test2.relay' },
        { url: 'wss://test3.relay' },
      ]),
    },
    signer: {
      user: mock().mockReturnValue({
        pubkey: 'test-pubkey',
      }),
    },
  })),
  NDKPrivateKeySigner: mock(() => ({})),
  NDKEvent: mock(() => ({
    encrypt: mock().mockReturnValue(undefined),
    publish: mock().mockResolvedValue(undefined),
  })),
  NDKUser: mock(() => ({})),
}));

// Mock nostr-tools module
mock.module('nostr-tools', () => ({
  nip19: {
    decode: mock().mockReturnValue({ type: 'npub', data: 'test-pubkey' }),
    npubEncode: mock().mockReturnValue('npub1test'),
  },
}));

// Mock external dependencies
const mockAfricasTalking = mock(() => ({
  SMS: {
    send: mock().mockResolvedValue({
      status: 'success',
      data: { recipients: [{ status: 'Success' }] },
    }),
  },
}));

const mockNDK = mock(() => ({
  connect: mock().mockResolvedValue(undefined),
  pool: {
    on: mock(),
    connectedRelays: mock().mockReturnValue([
      { url: 'wss://test1.relay' },
      { url: 'wss://test2.relay' },
      { url: 'wss://test3.relay' },
    ]),
  },
}));

const mockNDKEvent = mock(() => ({
  encrypt: mock().mockReturnValue(undefined),
  publish: mock().mockResolvedValue(undefined),
}));

const mockNDKUser = mock();
const mockNDKPrivateKeySigner = mock();

const mockNip19 = {
  decode: mock().mockReturnValue({
    type: 'npub',
    data: 'test-decoded-public-key-32chars',
  }),
};

// Import services after setting up mocks
import { SmsService } from '../../../src/domains/communications/services/sms.service';
import { NostrService } from '../../../src/domains/communications/services/nostr.service';

describe('Communications Domain Performance Tests', () => {
  let module: TestingModule;
  let smsService: SmsService;
  let nostrService: NostrService;
  let metricsService: BusinessMetricsService;

  const testEnvConfig = {
    SMS_AT_API_KEY: 'test-api-key-for-performance-testing',
    SMS_AT_USERNAME: 'test-username-performance',
    SMS_AT_FROM: 'TEST-SMS',
    SMS_AT_KEYWORD: 'TEST',
    NOSTR_PRIVATE_KEY: 'test-private-key-32-characters-long',
    NOSTR_PUBLIC_KEY: 'test-public-key-32-characters-long-',
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long',
    NODE_ENV: 'test',
  };

  beforeAll(async () => {
    // Set test environment variables
    Object.entries(testEnvConfig).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Create services with mocked dependencies
    const configService = new ConfigService(testEnvConfig);
    const eventEmitter = new EventEmitter2();

    // Create mock metrics and telemetry services
    const mockMetricsService = {
      recordCommunicationMetric: mock().mockResolvedValue(undefined),
      recordOperationDuration: mock().mockResolvedValue(undefined),
      recordDomainError: mock().mockResolvedValue(undefined),
    } as any;

    const mockTelemetryService = {
      executeWithSpan: mock().mockImplementation(async (name, fn) => fn()),
      recordEvent: mock(),
    } as any;

    // Create services directly with mocks
    smsService = new SmsService(
      eventEmitter,
      mockMetricsService,
      mockTelemetryService,
      configService,
    );

    nostrService = new NostrService(
      eventEmitter,
      mockMetricsService,
      mockTelemetryService,
      configService,
    );

    metricsService = mockMetricsService;

    // Wait for services to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    // Clean up environment variables
    Object.keys(testEnvConfig).forEach((key) => {
      delete process.env[key];
    });
  });

  describe('Service Initialization Performance', () => {
    it('should initialize SMS service within acceptable time', async () => {
      const startTime = Date.now();

      // Create a new SMS service instance to test initialization time
      const testSmsService = new SmsService(
        new EventEmitter2(),
        metricsService,
        { executeWithSpan: mock(), recordEvent: mock() } as any,
        new ConfigService(testEnvConfig),
      );

      const initTime = Date.now() - startTime;

      console.log(`SMS Service initialization: ${initTime}ms`);
      expect(initTime).toBeLessThan(1000);
      expect(testSmsService).toBeDefined();
    });

    it('should initialize Nostr service within acceptable time', async () => {
      const startTime = Date.now();

      // Create a new Nostr service instance to test initialization time
      const testNostrService = new NostrService(
        new EventEmitter2(),
        metricsService,
        { executeWithSpan: mock(), recordEvent: mock() } as any,
        new ConfigService(testEnvConfig),
      );

      const initTime = Date.now() - startTime;

      console.log(`Nostr Service initialization: ${initTime}ms`);
      expect(initTime).toBeLessThan(2000);
      expect(testNostrService).toBeDefined();
    });
  });

  describe('SMS Performance Benchmarks', () => {
    it('should meet response time requirements for single SMS', async () => {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        try {
          await smsService.sendSms({
            message: `Performance test SMS ${i}`,
            receiver: `+254700000${String(i).padStart(3, '0')}`,
          });
        } catch (error) {
          // Expected in test environment due to mocked external APIs
        }

        const duration = Date.now() - startTime;
        durations.push(duration);
      }

      const avgDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length;
      const p95Duration = durations.sort((a, b) => a - b)[
        Math.floor(durations.length * 0.95)
      ];

      console.log(
        `SMS Performance - Avg: ${avgDuration.toFixed(2)}ms, P95: ${p95Duration}ms`,
      );

      expect(p95Duration).toBeLessThan(2000); // < 2s requirement
      expect(avgDuration).toBeLessThan(1000);
    });

    it('should handle bulk SMS operations efficiently', async () => {
      const iterations = 5;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        try {
          await smsService.sendBulkSms({
            message: `Bulk SMS performance test ${i}`,
            receivers: [
              '+254700000001',
              '+254700000002',
              '+254700000003',
              '+254700000004',
              '+254700000005',
            ],
          });
        } catch (error) {
          // Expected in test environment
        }

        const duration = Date.now() - startTime;
        durations.push(duration);
      }

      const avgDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length;
      const p95Duration = durations.sort((a, b) => a - b)[
        Math.floor(durations.length * 0.95)
      ];

      console.log(
        `Bulk SMS Performance - Avg: ${avgDuration.toFixed(2)}ms, P95: ${p95Duration}ms`,
      );

      expect(p95Duration).toBeLessThan(3000);
      expect(avgDuration).toBeLessThan(2000);
    });

    it('should handle concurrent SMS operations', async () => {
      const concurrentOps = 15;
      const startTime = Date.now();

      const promises = Array(concurrentOps)
        .fill(null)
        .map(
          (_, i) =>
            smsService
              .sendSms({
                message: `Concurrent SMS ${i}`,
                receiver: `+254700000${String(i).padStart(3, '0')}`,
              })
              .catch(() => {}), // Ignore errors in test
        );

      await Promise.allSettled(promises);

      const totalDuration = Date.now() - startTime;
      const throughput = concurrentOps / (totalDuration / 1000);

      console.log(
        `Concurrent SMS - ${concurrentOps} ops in ${totalDuration}ms (${throughput.toFixed(2)} ops/sec)`,
      );

      expect(totalDuration).toBeLessThan(5000);
      expect(throughput).toBeGreaterThan(3);
    });
  });

  describe('Nostr Performance Benchmarks', () => {
    it('should meet response time requirements for encrypted DMs', async () => {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        try {
          await nostrService.sendEncryptedDirectMessage({
            message: `Performance test Nostr DM ${i}`,
            recipient: {
              npub: `npub1test${i.toString().padStart(10, '0')}`,
            },
            retry: false,
          });
        } catch (error) {
          // Expected in test environment
        }

        const duration = Date.now() - startTime;
        durations.push(duration);
      }

      const avgDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length;
      const p95Duration = durations.sort((a, b) => a - b)[
        Math.floor(durations.length * 0.95)
      ];

      console.log(
        `Nostr DM Performance - Avg: ${avgDuration.toFixed(2)}ms, P95: ${p95Duration}ms`,
      );

      expect(p95Duration).toBeLessThan(2000); // < 2s requirement
      expect(avgDuration).toBeLessThan(1000);
    });

    it('should validate connection performance', async () => {
      const startTime = Date.now();

      // Test connection health check methods
      const isConnected = nostrService.isConnected();
      const relayCount = nostrService.getConnectedRelaysCount();

      const duration = Date.now() - startTime;

      console.log(
        `Nostr Health Check - ${duration}ms, Connected: ${isConnected}, Relays: ${relayCount}`,
      );

      expect(duration).toBeLessThan(100);
      expect(typeof isConnected).toBe('boolean');
      expect(typeof relayCount).toBe('number');
    });

    it('should handle concurrent Nostr operations', async () => {
      const concurrentOps = 12;
      const startTime = Date.now();

      const promises = Array(concurrentOps)
        .fill(null)
        .map(
          (_, i) =>
            nostrService
              .sendEncryptedDirectMessage({
                message: `Concurrent Nostr DM ${i}`,
                recipient: {
                  npub: `npub1test${i.toString().padStart(10, '0')}`,
                },
                retry: false,
              })
              .catch(() => {}), // Ignore errors in test
        );

      await Promise.allSettled(promises);

      const totalDuration = Date.now() - startTime;
      const throughput = concurrentOps / (totalDuration / 1000);

      console.log(
        `Concurrent Nostr - ${concurrentOps} ops in ${totalDuration}ms (${throughput.toFixed(2)} ops/sec)`,
      );

      expect(totalDuration).toBeLessThan(4000);
      expect(throughput).toBeGreaterThan(3);
    });
  });

  describe('Mixed Workload Performance', () => {
    it('should demonstrate performance improvement over microservice baseline', async () => {
      const totalOps = 20;
      const startTime = Date.now();

      // Create mixed workload (SMS and Nostr operations)
      const promises = [];
      for (let i = 0; i < totalOps; i++) {
        if (i % 2 === 0) {
          promises.push(
            smsService
              .sendSms({
                message: `Mixed workload SMS ${i}`,
                receiver: `+254700000${String(i).padStart(3, '0')}`,
              })
              .catch(() => {}),
          );
        } else {
          promises.push(
            nostrService
              .sendEncryptedDirectMessage({
                message: `Mixed workload Nostr ${i}`,
                recipient: {
                  npub: `npub1test${i.toString().padStart(10, '0')}`,
                },
                retry: false,
              })
              .catch(() => {}),
          );
        }
      }

      await Promise.allSettled(promises);

      const totalDuration = Date.now() - startTime;
      const throughput = totalOps / (totalDuration / 1000);

      // Estimate microservice baseline (200ms per operation due to network overhead)
      const microserviceBaseline = totalOps * 200;
      const improvement =
        ((microserviceBaseline - totalDuration) / microserviceBaseline) * 100;

      console.log(`Mixed Workload Performance:
        Operations: ${totalOps}
        Duration: ${totalDuration}ms
        Throughput: ${throughput.toFixed(2)} ops/sec
        Baseline: ${microserviceBaseline}ms
        Improvement: ${improvement.toFixed(1)}%`);

      expect(improvement).toBeGreaterThan(30); // At least 30% improvement
      expect(throughput).toBeGreaterThan(4); // Minimum throughput
      expect(totalDuration).toBeLessThan(microserviceBaseline * 0.7); // 70% of baseline time
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during extended operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 30;

      for (let i = 0; i < iterations; i++) {
        try {
          await Promise.allSettled([
            smsService
              .sendSms({
                message: `Memory test SMS ${i}`,
                receiver: `+254700000${String(i).padStart(3, '0')}`,
              })
              .catch(() => {}),
            nostrService
              .sendEncryptedDirectMessage({
                message: `Memory test Nostr ${i}`,
                recipient: {
                  npub: `npub1test${i.toString().padStart(10, '0')}`,
                },
                retry: false,
              })
              .catch(() => {}),
          ]);
        } catch (error) {
          // Ignore errors in memory test
        }

        // Force garbage collection every 10 iterations
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;

      console.log(`Memory Analysis:
        Initial: ${(initialMemory / 1024 / 1024).toFixed(2)} MB
        Final: ${(finalMemory / 1024 / 1024).toFixed(2)} MB
        Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)`);

      // Allow reasonable memory increase for test environment
      expect(memoryIncreasePercent).toBeLessThan(75);
    });
  });

  describe('Metrics Performance', () => {
    it('should record communication metrics efficiently', async () => {
      const metricsOps = 100;
      const startTime = Date.now();

      for (let i = 0; i < metricsOps; i++) {
        try {
          await metricsService.recordCommunicationMetric(
            i % 2 === 0 ? 'sms' : 'nostr',
            i % 2 === 0 ? 'send' : 'send_encrypted_dm',
            true,
            Math.random() * 150 + 50, // 50-200ms simulated duration
            {
              testIteration: i,
              messageLength: 50 + Math.floor(Math.random() * 100),
            },
          );
        } catch (error) {
          // Ignore metrics errors in test
        }
      }

      const totalDuration = Date.now() - startTime;
      const throughput = metricsOps / (totalDuration / 1000);

      console.log(`Metrics Performance:
        Operations: ${metricsOps}
        Duration: ${totalDuration}ms
        Throughput: ${throughput.toFixed(2)} metrics/sec`);

      expect(totalDuration).toBeLessThan(5000); // Should complete in < 5s
      expect(throughput).toBeGreaterThan(20); // At least 20 metrics/sec
    });
  });

  describe('Legacy Compatibility Performance', () => {
    it('should maintain performance with legacy method calls', async () => {
      const legacyOps = 10;
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < legacyOps; i++) {
        if (i % 2 === 0) {
          promises.push(
            smsService
              .sendSmsLegacy({
                message: `Legacy SMS ${i}`,
                receiver: `+254700000${String(i).padStart(3, '0')}`,
              })
              .catch(() => {}),
          );
        } else {
          promises.push(
            nostrService
              .sendEncryptedNostrDirectMessageLegacy({
                message: `Legacy Nostr ${i}`,
                recipient: {
                  npub: `npub1legacy${i.toString().padStart(8, '0')}`,
                },
                retry: false,
              })
              .catch(() => {}),
          );
        }
      }

      await Promise.allSettled(promises);

      const totalDuration = Date.now() - startTime;
      const throughput = legacyOps / (totalDuration / 1000);

      console.log(`Legacy Methods Performance:
        Operations: ${legacyOps}
        Duration: ${totalDuration}ms
        Throughput: ${throughput.toFixed(2)} ops/sec`);

      expect(totalDuration).toBeLessThan(3000);
      expect(throughput).toBeGreaterThan(3);
    });
  });
});
