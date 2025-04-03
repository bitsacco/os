import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  SwapMetricsService, 
  SWAP_ONRAMP_METRIC, 
  SWAP_OFFRAMP_METRIC, 
  SWAP_QUOTE_METRIC,
  SWAP_FX_METRIC
} from './swap.metrics';

describe('SwapMetricsService', () => {
  let service: SwapMetricsService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapMetricsService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SwapMetricsService>(SwapMetricsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordOnrampMetric', () => {
    it('should record onramp metrics and emit event', () => {
      const metric = {
        txId: 'test-tx-id',
        userId: 'test-user-id',
        success: true,
        duration: 1000,
        amountKes: 5000,
        amountSats: 10000,
        conversionRate: 0.5,
        paymentMethod: 'mpesa',
      };

      service.recordOnrampMetric(metric);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        SWAP_ONRAMP_METRIC,
        expect.objectContaining({
          ...metric,
          timestamp: expect.any(String),
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.onramp.count).toBe(1);
      expect(metrics.onramp.successful).toBe(1);
      expect(metrics.onramp.totalKes).toBe(5000);
      expect(metrics.onramp.totalSats).toBe(10000);
      expect(metrics.onramp.byPaymentMethod.mpesa).toBe(1);
    });

    it('should track failed onramp metrics', () => {
      const metric = {
        txId: 'test-tx-id',
        userId: 'test-user-id',
        success: false,
        duration: 1000,
        errorType: 'payment_failed',
      };

      service.recordOnrampMetric(metric);

      const metrics = service.getMetrics();
      expect(metrics.onramp.count).toBe(1);
      expect(metrics.onramp.successful).toBe(0);
      expect(metrics.errors.payment_failed).toBe(1);
    });
  });

  describe('recordOfframpMetric', () => {
    it('should record offramp metrics and emit event', () => {
      const metric = {
        txId: 'test-tx-id',
        userId: 'test-user-id',
        success: true,
        duration: 1000,
        amountKes: 5000,
        amountSats: 10000,
        conversionRate: 0.5,
        payoutMethod: 'mpesa',
      };

      service.recordOfframpMetric(metric);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        SWAP_OFFRAMP_METRIC,
        expect.objectContaining({
          ...metric,
          timestamp: expect.any(String),
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.offramp.count).toBe(1);
      expect(metrics.offramp.successful).toBe(1);
      expect(metrics.offramp.totalKes).toBe(5000);
      expect(metrics.offramp.totalSats).toBe(10000);
      expect(metrics.offramp.byPayoutMethod.mpesa).toBe(1);
    });
  });

  describe('recordQuoteMetric', () => {
    it('should record quote metrics and emit event', () => {
      const metric = {
        userId: 'test-user-id',
        success: true,
        duration: 500,
        direction: 'onramp' as const,
        amountKes: 5000,
        amountSats: 10000,
        conversionRate: 0.5,
      };

      service.recordQuoteMetric(metric);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        SWAP_QUOTE_METRIC,
        expect.objectContaining({
          ...metric,
          timestamp: expect.any(String),
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.quote.count).toBe(1);
      expect(metrics.quote.successful).toBe(1);
    });
  });

  describe('recordFxMetric', () => {
    it('should record FX rate metrics and emit event', () => {
      const metric = {
        success: true,
        duration: 500,
        rateType: 'buy' as const,
        rate: 4500000,
        cached: false,
      };

      service.recordFxMetric(metric);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        SWAP_FX_METRIC,
        expect.objectContaining({
          ...metric,
          timestamp: expect.any(String),
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.fx.latestBuyRate).toBe(4500000);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to zero', () => {
      // Record some metrics first
      service.recordOnrampMetric({
        txId: 'test-tx-id',
        userId: 'test-user-id',
        success: true,
        duration: 1000,
        amountKes: 5000,
        amountSats: 10000,
      });

      service.recordOfframpMetric({
        txId: 'test-tx-id',
        userId: 'test-user-id',
        success: true,
        duration: 1000,
        amountKes: 5000,
        amountSats: 10000,
      });

      // Verify metrics were recorded
      let metrics = service.getMetrics();
      expect(metrics.onramp.count).toBe(1);
      expect(metrics.offramp.count).toBe(1);

      // Reset metrics
      service.resetMetrics();

      // Verify metrics were reset
      metrics = service.getMetrics();
      expect(metrics.onramp.count).toBe(0);
      expect(metrics.offramp.count).toBe(0);
      expect(metrics.onramp.totalKes).toBe(0);
      expect(metrics.offramp.totalSats).toBe(0);
    });
  });
});