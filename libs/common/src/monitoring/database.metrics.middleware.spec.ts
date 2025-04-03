import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseMetricsMiddleware } from './database.metrics.middleware';
import { CoreMetricsService } from './core.metrics';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describe, expect, it, jest, beforeEach } from 'bun:test';

describe('DatabaseMetricsMiddleware', () => {
  let middleware: DatabaseMetricsMiddleware;
  let metricsService: CoreMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseMetricsMiddleware,
        CoreMetricsService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    middleware = module.get<DatabaseMetricsMiddleware>(DatabaseMetricsMiddleware);
    metricsService = module.get<CoreMetricsService>(CoreMetricsService);

    // Mock recordDatabaseMetric
    metricsService.recordDatabaseMetric = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('createMiddleware', () => {
    it('should create middleware functions for a collection', () => {
      const collectionName = 'users';
      const middlewareFunctions = middleware.createMiddleware(collectionName);

      expect(middlewareFunctions).toBeDefined();
      expect(middlewareFunctions.preFindMiddleware).toBeDefined();
      expect(middlewareFunctions.postFindMiddleware).toBeDefined();
      expect(middlewareFunctions.preFindOneMiddleware).toBeDefined();
      expect(middlewareFunctions.postFindOneMiddleware).toBeDefined();
      expect(middlewareFunctions.preSaveMiddleware).toBeDefined();
      expect(middlewareFunctions.postSaveMiddleware).toBeDefined();
      expect(middlewareFunctions.preRemoveMiddleware).toBeDefined();
      expect(middlewareFunctions.postRemoveMiddleware).toBeDefined();
      expect(middlewareFunctions.errorMiddleware).toBeDefined();
    });
  });

  describe('middleware functions', () => {
    const collectionName = 'users';
    let middlewareFunctions: any;

    beforeEach(() => {
      middlewareFunctions = middleware.createMiddleware(collectionName);
    });

    it('should track find operations', () => {
      // Create context with start time
      const context = { _startTime: Date.now() - 100 };
      const docs = [{ id: 1, name: 'Test' }];
      const next = jest.fn();

      // Bind context to middleware function
      middlewareFunctions.postFindMiddleware.call(context, docs, next);

      expect(metricsService.recordDatabaseMetric).toHaveBeenCalledWith({
        operation: 'find',
        collection: collectionName,
        success: true,
        duration: expect.any(Number),
      });
      expect(next).toHaveBeenCalled();
    });

    it('should track findOne operations', () => {
      // Create context with start time
      const context = { _startTime: Date.now() - 100 };
      const doc = { id: 1, name: 'Test' };
      const next = jest.fn();

      // Bind context to middleware function
      middlewareFunctions.postFindOneMiddleware.call(context, doc, next);

      expect(metricsService.recordDatabaseMetric).toHaveBeenCalledWith({
        operation: 'findOne',
        collection: collectionName,
        success: true,
        duration: expect.any(Number),
      });
      expect(next).toHaveBeenCalled();
    });

    it('should track create operations', () => {
      // Create context with start time
      const context = { _startTime: Date.now() - 100 };
      const doc = { id: 1, name: 'Test', isNew: true };
      const next = jest.fn();

      // Bind context to middleware function
      middlewareFunctions.postSaveMiddleware.call(context, doc, next);

      expect(metricsService.recordDatabaseMetric).toHaveBeenCalledWith({
        operation: 'create',
        collection: collectionName,
        success: true,
        duration: expect.any(Number),
      });
      expect(next).toHaveBeenCalled();
    });

    it('should track update operations', () => {
      // Create context with start time
      const context = { _startTime: Date.now() - 100 };
      const doc = { id: 1, name: 'Test', isNew: false };
      const next = jest.fn();

      // Bind context to middleware function
      middlewareFunctions.postSaveMiddleware.call(context, doc, next);

      expect(metricsService.recordDatabaseMetric).toHaveBeenCalledWith({
        operation: 'update',
        collection: collectionName,
        success: true,
        duration: expect.any(Number),
      });
      expect(next).toHaveBeenCalled();
    });

    it('should track delete operations', () => {
      // Create context with start time
      const context = { _startTime: Date.now() - 100 };
      const doc = { id: 1, name: 'Test' };
      const next = jest.fn();

      // Bind context to middleware function
      middlewareFunctions.postRemoveMiddleware.call(context, doc, next);

      expect(metricsService.recordDatabaseMetric).toHaveBeenCalledWith({
        operation: 'delete',
        collection: collectionName,
        success: true,
        duration: expect.any(Number),
      });
      expect(next).toHaveBeenCalled();
    });

    it('should track errors', () => {
      // Create context with start time and operation
      const context = { _startTime: Date.now() - 100, op: 'findOne' };
      const error = new Error('Document not found');
      const next = jest.fn();

      // Bind context to middleware function
      middlewareFunctions.errorMiddleware.call(context, error, next);

      expect(metricsService.recordDatabaseMetric).toHaveBeenCalledWith({
        operation: 'findOne',
        collection: collectionName,
        success: false,
        duration: expect.any(Number),
        errorType: 'Error',
      });
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('applyMiddleware', () => {
    it('should apply middleware functions to a schema', () => {
      const collectionName = 'users';
      const mockSchema = {
        pre: jest.fn(),
        post: jest.fn(),
      };

      middleware.applyMiddleware(mockSchema, collectionName);

      // Should apply pre middleware for all operations
      expect(mockSchema.pre).toHaveBeenCalledWith('find', expect.any(Function));
      expect(mockSchema.pre).toHaveBeenCalledWith('findOne', expect.any(Function));
      expect(mockSchema.pre).toHaveBeenCalledWith('save', expect.any(Function));
      expect(mockSchema.pre).toHaveBeenCalledWith('remove', expect.any(Function));
      expect(mockSchema.pre).toHaveBeenCalledWith('aggregate', expect.any(Function));

      // Should apply post middleware for all operations
      expect(mockSchema.post).toHaveBeenCalledWith('find', expect.any(Function));
      expect(mockSchema.post).toHaveBeenCalledWith('findOne', expect.any(Function));
      expect(mockSchema.post).toHaveBeenCalledWith('save', expect.any(Function));
      expect(mockSchema.post).toHaveBeenCalledWith('remove', expect.any(Function));
      expect(mockSchema.post).toHaveBeenCalledWith('aggregate', expect.any(Function));

      // Should apply error middleware for all operations
      expect(mockSchema.post).toHaveBeenCalledWith('find', expect.any(Function));
      expect(mockSchema.post).toHaveBeenCalledWith('findOne', expect.any(Function));
      expect(mockSchema.post).toHaveBeenCalledWith('save', expect.any(Function));
      expect(mockSchema.post).toHaveBeenCalledWith('remove', expect.any(Function));
      expect(mockSchema.post).toHaveBeenCalledWith('aggregate', expect.any(Function));
    });
  });
});