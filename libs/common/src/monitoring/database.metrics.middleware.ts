import { Injectable, Logger } from '@nestjs/common';
import { CoreMetricsService } from './core.metrics';

/**
 * Mongoose middleware for database operation metrics
 * To be used with the Mongoose schema to track database operations
 */
@Injectable()
export class DatabaseMetricsMiddleware {
  private readonly logger = new Logger(DatabaseMetricsMiddleware.name);

  constructor(private readonly metricsService: CoreMetricsService) {}

  /**
   * Create middleware functions for a specific collection
   * @param collectionName The name of the collection
   * @returns Object containing middleware functions for different operations
   */
  createMiddleware(collectionName: string) {
    const self = this;

    return {
      /**
       * Pre-find middleware
       */
      preFindMiddleware: function (next: Function) {
        // Store start time in query object
        this._startTime = Date.now();
        next();
      },

      /**
       * Post-find middleware
       */
      postFindMiddleware: function (docs: any, next: Function) {
        const duration = Date.now() - (this._startTime || 0);
        const success = !!docs;

        self.metricsService.recordDatabaseMetric({
          operation: 'find',
          collection: collectionName,
          success,
          duration,
          errorType: success ? undefined : 'DocumentNotFound',
        });

        next();
      },

      /**
       * Pre-findOne middleware
       */
      preFindOneMiddleware: function (next: Function) {
        this._startTime = Date.now();
        next();
      },

      /**
       * Post-findOne middleware
       */
      postFindOneMiddleware: function (doc: any, next: Function) {
        const duration = Date.now() - (this._startTime || 0);
        const success = !!doc;

        self.metricsService.recordDatabaseMetric({
          operation: 'findOne',
          collection: collectionName,
          success,
          duration,
          errorType: success ? undefined : 'DocumentNotFound',
        });

        next();
      },

      /**
       * Pre-save middleware
       */
      preSaveMiddleware: function (next: Function) {
        this._startTime = Date.now();
        next();
      },

      /**
       * Post-save middleware
       */
      postSaveMiddleware: function (doc: any, next: Function) {
        const duration = Date.now() - (this._startTime || 0);
        const operation = doc.isNew ? 'create' : 'update';

        self.metricsService.recordDatabaseMetric({
          operation,
          collection: collectionName,
          success: true,
          duration,
        });

        next();
      },

      /**
       * Pre-remove middleware
       */
      preRemoveMiddleware: function (next: Function) {
        this._startTime = Date.now();
        next();
      },

      /**
       * Post-remove middleware
       */
      postRemoveMiddleware: function (doc: any, next: Function) {
        const duration = Date.now() - (this._startTime || 0);

        self.metricsService.recordDatabaseMetric({
          operation: 'delete',
          collection: collectionName,
          success: true,
          duration,
        });

        next();
      },

      /**
       * Error middleware - captures errors in any operation
       */
      errorMiddleware: function (err: Error, next: Function) {
        const duration = Date.now() - (this._startTime || Date.now());

        self.metricsService.recordDatabaseMetric({
          operation: this.op || 'unknown',
          collection: collectionName,
          success: false,
          duration,
          errorType: err.name || 'DatabaseError',
        });

        next(err);
      },
    };
  }

  /**
   * Apply middleware to a schema
   * @param schema Mongoose schema
   * @param collectionName Collection name
   */
  applyMiddleware(schema: any, collectionName: string) {
    const middleware = this.createMiddleware(collectionName);

    // Find middleware
    schema.pre('find', middleware.preFindMiddleware);
    schema.post('find', middleware.postFindMiddleware);

    // FindOne middleware
    schema.pre('findOne', middleware.preFindOneMiddleware);
    schema.post('findOne', middleware.postFindOneMiddleware);

    // Save middleware
    schema.pre('save', middleware.preSaveMiddleware);
    schema.post('save', middleware.postSaveMiddleware);

    // Remove middleware
    schema.pre('remove', middleware.preRemoveMiddleware);
    schema.post('remove', middleware.postRemoveMiddleware);

    // Aggregate middleware
    schema.pre('aggregate', middleware.preFindMiddleware);
    schema.post('aggregate', middleware.postFindMiddleware);

    // Error middleware for all operations
    schema.post('find', middleware.errorMiddleware);
    schema.post('findOne', middleware.errorMiddleware);
    schema.post('save', middleware.errorMiddleware);
    schema.post('remove', middleware.errorMiddleware);
    schema.post('aggregate', middleware.errorMiddleware);

    this.logger.log(`Database metrics middleware applied to ${collectionName}`);
  }
}
