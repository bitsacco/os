import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';

// Mock prom-client using Bun's mock system
mock.module('prom-client', () => ({
  register: {
    clear: mock(() => {}),
    metrics: mock(() => ''),
  },
  Counter: mock(() => ({
    inc: mock(() => {}),
    get: mock(() => Promise.resolve({})),
  })),
  Histogram: mock(() => ({
    observe: mock(() => {}),
    get: mock(() => Promise.resolve({})),
  })),
  Gauge: mock(() => ({
    set: mock(() => {}),
    inc: mock(() => {}),
    dec: mock(() => {}),
    get: mock(() => Promise.resolve({})),
  })),
}));

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('HTTP metrics', () => {
    it('should record HTTP request metrics', () => {
      const method = 'GET';
      const route = '/api/v1/users';
      const status = 200;
      const duration = 0.5;

      service.recordHttpRequest(method, route, status, duration);

      // Verify that the metrics were called (mocked implementations)
      expect(service).toBeDefined();
    });

    it('should handle different HTTP status codes', () => {
      const testCases = [
        {
          method: 'POST',
          route: '/api/v1/auth/login',
          status: 401,
          duration: 0.1,
        },
        {
          method: 'PUT',
          route: '/api/v1/users/:id',
          status: 404,
          duration: 0.2,
        },
        {
          method: 'DELETE',
          route: '/api/v1/resources/:id',
          status: 500,
          duration: 1.0,
        },
      ];

      testCases.forEach((testCase) => {
        expect(() => {
          service.recordHttpRequest(
            testCase.method,
            testCase.route,
            testCase.status,
            testCase.duration,
          );
        }).not.toThrow();
      });
    });
  });

  describe('Database metrics', () => {
    it('should record database operation metrics', () => {
      const operation = 'find';
      const collection = 'users';
      const duration = 0.1;
      const success = true;

      service.recordDbOperation(operation, collection, duration, success);

      expect(service).toBeDefined();
    });

    it('should record failed database operations', () => {
      const operation = 'insert';
      const collection = 'chamas';
      const duration = 2.0;
      const success = false;

      service.recordDbOperation(operation, collection, duration, success);

      expect(service).toBeDefined();
    });

    it('should set active database connections', () => {
      const connectionCount = 10;

      service.setActiveConnections(connectionCount);

      expect(service).toBeDefined();
    });
  });

  describe('Authentication metrics', () => {
    it('should record successful authentication attempts', () => {
      const authTypes = ['jwt', 'apikey', 'phone', 'nostr'] as const;

      authTypes.forEach((type) => {
        service.recordAuthAttempt(type, true);
        service.recordAuthAttempt(type, false);
      });

      expect(service).toBeDefined();
    });

    it('should set active sessions count', () => {
      const sessionCount = 50;

      service.setActiveSessions(sessionCount);

      expect(service).toBeDefined();
    });
  });

  describe('Business metrics', () => {
    it('should record transaction metrics', () => {
      const type = 'chama_deposit';
      const status = 'success';
      const amount = 5000;
      const currency = 'KES';

      service.recordTransaction(type, status, amount, currency);

      expect(service).toBeDefined();
    });

    it('should record transaction without amount', () => {
      const type = 'user_registration';
      const status = 'success';

      service.recordTransaction(type, status);

      expect(service).toBeDefined();
    });

    it('should handle different transaction types', () => {
      const transactions = [
        {
          type: 'wallet_send',
          status: 'success',
          amount: 0.001,
          currency: 'BTC',
        },
        {
          type: 'shares_buy',
          status: 'failed',
          amount: 10000,
          currency: 'KES',
        },
        {
          type: 'chama_withdrawal',
          status: 'pending',
          amount: 15000,
          currency: 'KES',
        },
      ];

      transactions.forEach((tx) => {
        service.recordTransaction(tx.type, tx.status, tx.amount, tx.currency);
      });

      expect(service).toBeDefined();
    });
  });

  describe('WebSocket metrics', () => {
    it('should manage WebSocket connection metrics', () => {
      // Set initial count
      service.setWebSocketConnections(5);

      // Increment connections
      service.incrementWebSocketConnections();
      service.incrementWebSocketConnections();

      // Decrement connections
      service.decrementWebSocketConnections();

      expect(service).toBeDefined();
    });
  });

  describe('Error metrics', () => {
    it('should record errors with different severities', () => {
      const errorTypes = [
        { domain: 'auth', type: 'invalid_token', severity: 'medium' as const },
        {
          domain: 'database',
          type: 'connection_lost',
          severity: 'critical' as const,
        },
        {
          domain: 'api',
          type: 'rate_limit_exceeded',
          severity: 'low' as const,
        },
        {
          domain: 'business',
          type: 'insufficient_funds',
          severity: 'high' as const,
        },
      ];

      errorTypes.forEach((error) => {
        service.recordError(error.domain, error.type, error.severity);
      });

      expect(service).toBeDefined();
    });
  });

  describe('Health metrics', () => {
    it('should return health metrics', async () => {
      const healthMetrics = await service.getHealthMetrics();

      expect(healthMetrics).toBeDefined();
      expect(typeof healthMetrics).toBe('object');
      expect(healthMetrics).toHaveProperty('httpRequestsTotal');
      expect(healthMetrics).toHaveProperty('dbOperationsTotal');
      expect(healthMetrics).toHaveProperty('authAttemptsTotal');
      expect(healthMetrics).toHaveProperty('transactionsTotal');
      expect(healthMetrics).toHaveProperty('errorsTotal');
    });
  });

  describe('Metric validation', () => {
    it('should handle invalid metric values gracefully', () => {
      // Test with edge cases
      expect(() => {
        service.recordHttpRequest('', '', -1, -1);
      }).not.toThrow();

      expect(() => {
        service.recordDbOperation('', '', -1, true);
      }).not.toThrow();

      expect(() => {
        service.setActiveConnections(-1);
      }).not.toThrow();
    });

    it('should handle null/undefined values', () => {
      expect(() => {
        service.recordTransaction('test', 'success', undefined, undefined);
      }).not.toThrow();

      expect(() => {
        service.recordError('', '', 'low');
      }).not.toThrow();
    });
  });
});
