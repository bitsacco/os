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
 * NestJS interceptor for automatic gRPC metrics collection
 * Captures service name, method name, duration, and errors
 */
@Injectable()
export class GrpcMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GrpcMetricsInterceptor.name);

  constructor(private readonly metricsService: CoreMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only intercept gRPC requests
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const startTime = Date.now();
    const rpcContext = context.switchToRpc();
    const handlerData = context.getHandler();
    const controllerClass = context.getClass();
    
    // Extract service and method names from context
    const serviceName = controllerClass.name.replace('Controller', '');
    const methodName = handlerData.name;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        
        this.metricsService.recordGrpcMetric({
          service: serviceName,
          method: methodName,
          success: true,
          duration,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        this.metricsService.recordGrpcMetric({
          service: serviceName,
          method: methodName,
          success: false,
          duration,
          errorType: error.code || error.message || 'Unknown',
        });
        
        return throwError(() => error);
      }),
    );
  }
}