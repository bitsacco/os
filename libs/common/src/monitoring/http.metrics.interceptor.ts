import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CoreMetricsService } from './core.metrics';

/**
 * NestJS interceptor for automatic HTTP request metrics collection
 * Captures request method, path, status code, duration, and errors
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpMetricsInterceptor.name);

  constructor(private readonly metricsService: CoreMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    
    // Normalize path to prevent cardinality explosion
    // Replaces numeric IDs with :id and UUID/hash patterns with :id
    const normalizedPath = this.normalizePath(url);
    
    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;
        const duration = Date.now() - startTime;
        
        // Consider request successful if status code is < 400
        const success = statusCode < 400;
        
        this.metricsService.recordApiMetric({
          method,
          path: normalizedPath,
          statusCode,
          success,
          duration,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;
        
        this.metricsService.recordApiMetric({
          method,
          path: normalizedPath,
          statusCode,
          success: false,
          duration,
          errorType: error.name || 'Unknown',
        });
        
        return throwError(() => error);
      }),
    );
  }

  /**
   * Normalize URL path to prevent cardinality explosion in metrics
   * Replaces numeric IDs and UUIDs with parameterized placeholders
   */
  private normalizePath(url: string): string {
    // Remove query parameters
    const pathOnly = url.split('?')[0];
    
    // Replace numeric IDs that appear as complete URL segments
    const numericReplaced = pathOnly.replace(/\/(\d+)(?=\/|$)/g, '/:id');
    
    // Replace UUIDs and hash patterns (common in API paths)
    return numericReplaced.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:uuid'
    ).replace(/\/[0-9a-f]{24,64}/gi, '/:hash');
  }
}