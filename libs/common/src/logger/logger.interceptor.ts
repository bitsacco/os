import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    // Check if this is a metrics endpoint
    const isMetricsEndpoint = url.includes('/metrics');

    console.log(`[HTTP Request] ${method} ${url}`);

    // Only log request body for non-metrics endpoints
    if (!isMetricsEndpoint) {
      console.log('Request Body:', JSON.stringify(request.body, null, 2));
    }

    return next.handle().pipe(
      tap((data) => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;
        console.log(
          `[HTTP Response] ${method} ${url} ${response.statusCode} - ${delay}ms`,
        );

        // Skip logging response body for metrics endpoints
        if (!isMetricsEndpoint) {
          console.log('Response Body:', JSON.stringify(data, null, 2));
        }
      }),
    );
  }
}
