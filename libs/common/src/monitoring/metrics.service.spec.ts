import { Logger } from '@nestjs/common';
import { MetricsService, OperationMetricsService } from './metrics.service';

// Mock the OpenTelemetry createMeter function
jest.mock('./opentelemetry', () => ({
  createMeter: jest.fn().mockImplementation(() => ({
    createCounter: jest.fn().mockImplementation((name) => ({
      add: jest.fn(),
      _name: name,
    })),
    createHistogram: jest.fn().mockImplementation((name) => ({
      record: jest.fn(),
      _name: name,
    })),
    createObservableGauge: jest.fn().mockImplementation((name) => ({
      addCallback: jest.fn(),
      _name: name,
    })),
  })),
}));

// Create a concrete implementation of MetricsService for testing
class TestMetricsService extends MetricsService {
  constructor() {
    super('test-service');
  }

  // Expose protected methods for testing
  public exposeCreateCounter(name: string, options: any) {
    return this.createCounter(name, options);
  }

  public exposeCreateHistogram(name: string, options: any) {
    return this.createHistogram(name, options);
  }

  public exposeIncrementCounter(name: string, data: any) {
    return this.incrementCounter(name, data);
  }

  public exposeRecordHistogram(name: string, data: any) {
    return this.recordHistogram(name, data);
  }

  // Get metrics for testing
  public getCounters() {
    return this.counters;
  }

  public getHistograms() {
    return this.histograms;
  }
}

// Create a concrete implementation of OperationMetricsService for testing
class TestOperationMetricsService extends OperationMetricsService {
  constructor() {
    super('test', 'operation');
  }

  // Expose protected fields for testing
  public getMetricNames() {
    return {
      totalOperationCounter: this.totalOperationCounter,
      successfulOperationCounter: this.successfulOperationCounter,
      failedOperationCounter: this.failedOperationCounter,
      operationDurationHistogram: this.operationDurationHistogram,
    };
  }

  // Get metrics for testing
  public getCounters() {
    return this.counters;
  }

  public getHistograms() {
    return this.histograms;
  }
}

describe('MetricsService', () => {
  let service: TestMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestMetricsService();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a counter', () => {
    const counter = service.exposeCreateCounter('test.counter', {
      description: 'Test counter',
    });
    expect(counter).toBeDefined();
    expect(service.getCounters().size).toEqual(1);
    expect(service.getCounters().has('test.counter')).toBeTruthy();
  });

  it('should create a histogram', () => {
    const histogram = service.exposeCreateHistogram('test.histogram', {
      description: 'Test histogram',
    });
    expect(histogram).toBeDefined();
    expect(service.getHistograms().size).toEqual(1);
    expect(service.getHistograms().has('test.histogram')).toBeTruthy();
  });

  it('should not recreate existing metrics', () => {
    service.exposeCreateCounter('test.counter', { description: 'Test counter' });
    service.exposeCreateCounter('test.counter', { description: 'Test counter again' });
    expect(service.getCounters().size).toEqual(1);
  });

  it('should handle counter increment', () => {
    const counter = service.exposeCreateCounter('test.counter', {
      description: 'Test counter',
    });
    
    // Create a spy on the counter's add method
    const spy = jest.spyOn(counter, 'add');
    
    service.exposeIncrementCounter('test.counter', { value: 1 });
    expect(spy).toHaveBeenCalledWith(1, undefined);
    
    service.exposeIncrementCounter('test.counter', { value: 2, labels: { foo: 'bar' } });
    expect(spy).toHaveBeenCalledWith(2, { foo: 'bar' });
  });

  it('should handle histogram recording', () => {
    const histogram = service.exposeCreateHistogram('test.histogram', {
      description: 'Test histogram',
    });
    
    // Create a spy on the histogram's record method
    const spy = jest.spyOn(histogram, 'record');
    
    service.exposeRecordHistogram('test.histogram', { value: 100 });
    expect(spy).toHaveBeenCalledWith(100, undefined);
    
    service.exposeRecordHistogram('test.histogram', { value: 200, labels: { foo: 'bar' } });
    expect(spy).toHaveBeenCalledWith(200, { foo: 'bar' });
  });

  it('should log warning when incrementing non-existent counter', () => {
    const logSpy = jest.spyOn(service['logger'], 'warn');
    service.exposeIncrementCounter('non.existent.counter', { value: 1 });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('should log warning when recording to non-existent histogram', () => {
    const logSpy = jest.spyOn(service['logger'], 'warn');
    service.exposeRecordHistogram('non.existent.histogram', { value: 100 });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });
});

describe('OperationMetricsService', () => {
  let service: TestOperationMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestOperationMetricsService();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize standard operation metrics', () => {
    const metricNames = service.getMetricNames();
    
    expect(metricNames.totalOperationCounter).toEqual('test.operation.total');
    expect(metricNames.successfulOperationCounter).toEqual('test.operation.success');
    expect(metricNames.failedOperationCounter).toEqual('test.operation.failure');
    expect(metricNames.operationDurationHistogram).toEqual('test.operation.duration');
    
    expect(service.getCounters().has('test.operation.total')).toBeTruthy();
    expect(service.getCounters().has('test.operation.success')).toBeTruthy();
    expect(service.getCounters().has('test.operation.failure')).toBeTruthy();
    expect(service.getHistograms().has('test.operation.duration')).toBeTruthy();
  });

  it('should record operation metrics', () => {
    // Create spies on the counters and histograms
    const totalSpy = jest.spyOn(service.getCounters().get('test.operation.total')!, 'add');
    const successSpy = jest.spyOn(service.getCounters().get('test.operation.success')!, 'add');
    const failureSpy = jest.spyOn(service.getCounters().get('test.operation.failure')!, 'add');
    const durationSpy = jest.spyOn(service.getHistograms().get('test.operation.duration')!, 'record');
    
    // Record a successful operation
    service.recordOperationMetric({
      operation: 'test',
      success: true,
      duration: 100,
      labels: { userId: '123' },
    });
    
    expect(totalSpy).toHaveBeenCalledWith(1, { userId: '123' });
    expect(successSpy).toHaveBeenCalledWith(1, { userId: '123' });
    expect(durationSpy).toHaveBeenCalledWith(100, {
      userId: '123',
      success: 'true',
      operation: 'test',
    });
    
    // Record a failed operation
    service.recordOperationMetric({
      operation: 'test',
      success: false,
      duration: 200,
      errorType: 'test_error',
      labels: { userId: '456' },
    });
    
    expect(totalSpy).toHaveBeenCalledWith(1, { userId: '456' });
    expect(failureSpy).toHaveBeenCalledWith(1, {
      userId: '456',
      errorType: 'test_error',
    });
    expect(durationSpy).toHaveBeenCalledWith(200, {
      userId: '456',
      success: 'false',
      operation: 'test',
    });
  });
});