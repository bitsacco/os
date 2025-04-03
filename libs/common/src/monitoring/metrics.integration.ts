import { INestApplication } from '@nestjs/common';
import { HttpMetricsInterceptor } from './http.metrics.interceptor';
import { GrpcMetricsInterceptor } from './grpc.metrics.interceptor';
import { DatabaseMetricsMiddleware } from './database.metrics.middleware';
import { CoreMetricsService } from './core.metrics';

/**
 * Helper functions to integrate metrics collection into NestJS applications
 */
export class MetricsIntegration {
  /**
   * Apply HTTP metrics interceptor to a NestJS application
   * @param app NestJS application
   * @param metricsService CoreMetricsService instance
   */
  static applyHttpMetricsInterceptor(
    app: INestApplication,
    metricsService: CoreMetricsService,
  ) {
    app.useGlobalInterceptors(new HttpMetricsInterceptor(metricsService));
  }

  /**
   * Apply gRPC metrics interceptor to a NestJS application
   * @param app NestJS application
   * @param metricsService CoreMetricsService instance
   */
  static applyGrpcMetricsInterceptor(
    app: INestApplication,
    metricsService: CoreMetricsService,
  ) {
    app.useGlobalInterceptors(new GrpcMetricsInterceptor(metricsService));
  }

  /**
   * Apply database metrics middleware to a Mongoose schema
   * @param schema Mongoose schema
   * @param collectionName Collection name
   * @param middleware DatabaseMetricsMiddleware instance
   */
  static applyDatabaseMetricsMiddleware(
    schema: any,
    collectionName: string,
    middleware: DatabaseMetricsMiddleware,
  ) {
    middleware.applyMiddleware(schema, collectionName);
  }

  /**
   * Apply all metrics interceptors and middleware to a NestJS application
   * @param app NestJS application
   * @param metricsService CoreMetricsService instance
   * @param databaseMiddleware DatabaseMetricsMiddleware instance
   */
  static applyAllMetricsInterceptors(
    app: INestApplication,
    metricsService: CoreMetricsService,
  ) {
    MetricsIntegration.applyHttpMetricsInterceptor(app, metricsService);
    MetricsIntegration.applyGrpcMetricsInterceptor(app, metricsService);
  }
}
