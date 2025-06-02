import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../../../infrastructure/monitoring/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const startTime = Date.now();
    const method = request.method;
    const route = this.extractRoute(request);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - startTime) / 1000; // Convert to seconds
          const statusCode = response.statusCode;

          this.metricsService.recordHttpRequest(
            method,
            route,
            statusCode,
            duration,
          );
        },
        error: (error) => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = error.status || 500;

          this.metricsService.recordHttpRequest(
            method,
            route,
            statusCode,
            duration,
          );

          // Record error metrics
          this.metricsService.recordError(
            'api',
            error.name || 'UnknownError',
            this.getErrorSeverity(statusCode),
          );
        },
      }),
    );
  }

  private extractRoute(request: Request): string {
    // Extract route pattern from request
    const route = request.route?.path;
    if (route) {
      return route;
    }

    // Fallback to URL path with normalized parameters
    const path = request.path;

    // Replace UUIDs and IDs with placeholders for better grouping
    return path
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/[0-9a-f]{24}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }

  private getErrorSeverity(
    statusCode: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (statusCode >= 500) return 'critical';
    if (statusCode >= 400) return 'medium';
    if (statusCode >= 300) return 'low';
    return 'low';
  }
}
