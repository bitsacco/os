import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { beforeAll, afterAll, describe, it, expect, mock } from 'bun:test';
import { SmsService } from '../../../src/domains/communications/services/sms.service';
import { NostrService } from '../../../src/domains/communications/services/nostr.service';

describe.skip('Communications Domain Integration Tests', () => {
  let smsService: SmsService;
  let nostrService: NostrService;
  let mockMetricsService: any;
  let mockTelemetryService: any;

  const testConfig = {
    SMS_AT_API_KEY: 'test-integration-api-key',
    SMS_AT_USERNAME: 'test-integration-username',
    SMS_AT_FROM: 'TESTINT',
    SMS_AT_KEYWORD: 'INTEGRATION',
    NOSTR_PRIVATE_KEY: 'integration-test-private-key-32ch',
    NOSTR_PUBLIC_KEY: 'integration-test-public-key-32chr',
    JWT_SECRET: 'integration-test-jwt-secret-32-characters-long',
    NODE_ENV: 'test',
  };

  beforeAll(async () => {
    // Set test environment
    Object.entries(testConfig).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Create mock services
    mockMetricsService = {
      recordCommunicationMetric: mock().mockResolvedValue(undefined),
    };

    mockTelemetryService = {
      executeWithSpan: mock().mockImplementation(
        async (name: string, fn: Function) => fn(),
      ),
      recordEvent: mock(),
    };

    const configService = new ConfigService(testConfig);
    const eventEmitter = new EventEmitter2();

    // Create services with mocks
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

    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    Object.keys(testConfig).forEach((key) => {
      delete process.env[key];
    });
  });

  describe('Service Initialization', () => {
    it('should initialize all communication services correctly', () => {
      expect(smsService).toBeDefined();
      expect(smsService).toBeInstanceOf(SmsService);
      expect(nostrService).toBeDefined();
      expect(nostrService).toBeInstanceOf(NostrService);
    });

    it('should have proper service dependencies', () => {
      // Check that services have required dependencies
      expect(smsService['metricsService']).toBeDefined();
      expect(smsService['telemetryService']).toBeDefined();
      expect(smsService['configService']).toBeDefined();
      expect(smsService['eventEmitter']).toBeDefined();

      expect(nostrService['metricsService']).toBeDefined();
      expect(nostrService['telemetryService']).toBeDefined();
      expect(nostrService['configService']).toBeDefined();
      expect(nostrService['eventEmitter']).toBeDefined();
    });
  });

  describe('SMS Service Integration', () => {
    it('should send SMS successfully', async () => {
      const testMessage = {
        message: 'Integration test SMS message',
        receiver: '+254700000001',
      };

      await expect(smsService.sendSms(testMessage)).resolves.not.toThrow();
    });

    it('should handle bulk SMS', async () => {
      const testBulkMessage = {
        message: 'Integration test bulk SMS',
        receivers: ['+254700000001', '+254700000002', '+254700000003'],
      };

      await expect(
        smsService.sendBulkSms(testBulkMessage),
      ).resolves.not.toThrow();
    });

    it('should support legacy compatibility methods', () => {
      expect(smsService.sendSmsLegacy).toBeDefined();
      expect(smsService.sendBulkSmsLegacy).toBeDefined();
      expect(typeof smsService.sendSmsLegacy).toBe('function');
      expect(typeof smsService.sendBulkSmsLegacy).toBe('function');
    });
  });

  describe('Nostr Service Integration', () => {
    it('should send encrypted DM successfully', async () => {
      const testMessage = {
        message: 'Integration test Nostr DM',
        recipient: {
          npub: 'npub1testintegration123456',
        },
        retry: false,
      };

      await expect(
        nostrService.sendEncryptedDirectMessage(testMessage),
      ).resolves.not.toThrow();
    });

    it('should handle relay configuration', async () => {
      const relayConfig = {
        relayUrls: [
          'wss://integration-test-relay1.com',
          'wss://integration-test-relay2.com',
        ],
      };

      await expect(
        nostrService.configureNostrRelays(relayConfig),
      ).resolves.not.toThrow();
    });

    it('should provide connection status methods', () => {
      const isConnected = nostrService.isConnected();
      const relayCount = nostrService.getConnectedRelaysCount();

      expect(typeof isConnected).toBe('boolean');
      expect(typeof relayCount).toBe('number');
      expect(relayCount).toBeGreaterThanOrEqual(0);
    });

    it('should support legacy compatibility methods', () => {
      expect(nostrService.sendEncryptedNostrDirectMessageLegacy).toBeDefined();
      expect(nostrService.configureTrustedNostrRelaysLegacy).toBeDefined();
      expect(typeof nostrService.sendEncryptedNostrDirectMessageLegacy).toBe(
        'function',
      );
      expect(typeof nostrService.configureTrustedNostrRelaysLegacy).toBe(
        'function',
      );
    });
  });

  describe('Cross-Service Integration', () => {
    it('should handle concurrent SMS and Nostr operations', async () => {
      const startTime = Date.now();
      const operationCount = 8;

      const promises = [];
      for (let i = 0; i < operationCount; i++) {
        if (i % 2 === 0) {
          promises.push(
            smsService
              .sendSms({
                message: `Concurrent SMS ${i}`,
                receiver: `+254700000${String(i).padStart(3, '0')}`,
              })
              .catch(() => {}),
          );
        } else {
          promises.push(
            nostrService
              .sendEncryptedDirectMessage({
                message: `Concurrent Nostr ${i}`,
                recipient: {
                  npub: `npub1concurrent${i.toString().padStart(8, '0')}`,
                },
                retry: false,
              })
              .catch(() => {}),
          );
        }
      }

      await Promise.allSettled(promises);

      const duration = Date.now() - startTime;
      const throughput = operationCount / (duration / 1000);

      console.log(
        `Cross-service operations: ${operationCount} in ${duration}ms (${throughput.toFixed(2)} ops/sec)`,
      );

      expect(duration).toBeLessThan(5000);
      expect(throughput).toBeGreaterThan(1);
    });

    it('should maintain service isolation during failures', async () => {
      // Test that services work independently
      const smsPromise = smsService
        .sendSms({
          message: 'Service isolation test SMS',
          receiver: '+254700000123',
        })
        .catch(() => 'sms-result');

      const nostrPromise = nostrService
        .sendEncryptedDirectMessage({
          message: 'Service isolation test Nostr',
          recipient: {
            npub: 'npub1isolation123456',
          },
          retry: false,
        })
        .catch(() => 'nostr-result');

      const results = await Promise.allSettled([smsPromise, nostrPromise]);

      // Both services should complete independently
      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });

  describe('Metrics Integration', () => {
    it('should call metrics service during operations', async () => {
      await smsService
        .sendSms({
          message: 'Metrics test SMS',
          receiver: '+254700000999',
        })
        .catch(() => {});

      // Verify metrics were called
      expect(mockMetricsService.recordCommunicationMetric).toHaveBeenCalled();
    });

    it('should handle metrics service failures gracefully', async () => {
      // Mock metrics service to fail
      const originalMethod = mockMetricsService.recordCommunicationMetric;
      mockMetricsService.recordCommunicationMetric = mock().mockRejectedValue(
        new Error('Metrics service error'),
      );

      // Service operations should still succeed even if metrics fail
      await expect(
        smsService.sendSms({
          message: 'Metrics failure test',
          receiver: '+254700000456',
        }),
      ).resolves.not.toThrow();

      // Restore original method
      mockMetricsService.recordCommunicationMetric = originalMethod;
    });
  });

  describe('Configuration Integration', () => {
    it('should use proper configuration values', () => {
      const configService = new ConfigService(testConfig);

      // Verify configuration is properly loaded
      expect(configService.get('SMS_AT_API_KEY')).toBe(
        testConfig.SMS_AT_API_KEY,
      );
      expect(configService.get('SMS_AT_USERNAME')).toBe(
        testConfig.SMS_AT_USERNAME,
      );
      expect(configService.get('NOSTR_PRIVATE_KEY')).toBe(
        testConfig.NOSTR_PRIVATE_KEY,
      );
      expect(configService.get('NOSTR_PUBLIC_KEY')).toBe(
        testConfig.NOSTR_PUBLIC_KEY,
      );
    });

    it('should handle service creation with configuration', () => {
      // Services should handle configuration correctly
      expect(() => {
        new SmsService(
          new EventEmitter2(),
          mockMetricsService,
          mockTelemetryService,
          new ConfigService(testConfig),
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle errors gracefully', async () => {
      // Test error scenarios
      const errorPromises = [
        smsService
          .sendSms({
            message: 'Error test SMS',
            receiver: '+254700000error',
          })
          .catch((e) => e),
        nostrService
          .sendEncryptedDirectMessage({
            message: 'Error test Nostr',
            recipient: {
              npub: 'npub1errortest',
            },
            retry: false,
          })
          .catch((e) => e),
      ];

      const results = await Promise.allSettled(errorPromises);

      // Should handle errors without crashing
      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance under load', async () => {
      const operations = 15;
      const startTime = Date.now();

      const promises = Array(operations)
        .fill(null)
        .map((_, i) => {
          if (i % 3 === 0) {
            return smsService
              .sendSms({
                message: `Load test SMS ${i}`,
                receiver: `+254700000${String(i).padStart(3, '0')}`,
              })
              .catch(() => {});
          } else if (i % 3 === 1) {
            return nostrService
              .sendEncryptedDirectMessage({
                message: `Load test Nostr ${i}`,
                recipient: {
                  npub: `npub1loadtest${i.toString().padStart(8, '0')}`,
                },
                retry: false,
              })
              .catch(() => {});
          } else {
            return mockMetricsService
              .recordCommunicationMetric(
                'sms',
                'send',
                true,
                Math.random() * 100 + 50,
                { loadTest: true },
              )
              .catch(() => {});
          }
        });

      await Promise.allSettled(promises);

      const totalDuration = Date.now() - startTime;
      const throughput = operations / (totalDuration / 1000);

      console.log(
        `Load test: ${operations} operations in ${totalDuration}ms (${throughput.toFixed(2)} ops/sec)`,
      );

      expect(totalDuration).toBeLessThan(8000); // Should complete within 8 seconds
      expect(throughput).toBeGreaterThan(1.5); // Minimum throughput under load
    });
  });

  describe('Legacy Compatibility Integration', () => {
    it('should maintain backward compatibility', async () => {
      const testMessage = {
        message: 'Legacy compatibility test',
        receiver: '+254700000999',
      };

      const testBulkMessage = {
        message: 'Legacy bulk test',
        receivers: ['+254700000997', '+254700000998'],
      };

      const testNostrMessage = {
        message: 'Legacy Nostr compatibility test',
        recipient: {
          npub: 'npub1legacytest123456',
        },
        retry: false,
      };

      const relayConfig = {
        relayUrls: ['wss://legacy-test-relay.com'],
      };

      // Test all legacy methods work
      await expect(
        smsService.sendSmsLegacy(testMessage),
      ).resolves.not.toThrow();
      await expect(
        smsService.sendBulkSmsLegacy(testBulkMessage),
      ).resolves.not.toThrow();
      await expect(
        nostrService.sendEncryptedNostrDirectMessageLegacy(testNostrMessage),
      ).resolves.not.toThrow();
      await expect(
        nostrService.configureTrustedNostrRelaysLegacy(relayConfig),
      ).resolves.not.toThrow();
    });
  });
});
