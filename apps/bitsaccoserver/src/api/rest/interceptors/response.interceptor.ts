import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: string;
    requestId: string;
    path: string;
    method: string;
    statusCode: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse();

    const requestId =
      (request.headers['x-request-id'] as string) || this.generateRequestId();

    // Set request ID in response headers
    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      map((data) => {
        const statusCode = response.statusCode || HttpStatus.OK;

        // Handle different response types
        if (this.isPaginatedResponse(data)) {
          return {
            success: statusCode < 400,
            data: data.documents || data.items || data.data,
            metadata: {
              timestamp: new Date().toISOString(),
              requestId,
              path: request.url,
              method: request.method,
              statusCode,
              pagination: {
                page: data.page || 1,
                limit: data.limit || 10,
                total: data.total || 0,
                totalPages: Math.ceil((data.total || 0) / (data.limit || 10)),
              },
            },
          };
        }

        // Handle standard responses
        return {
          success: statusCode < 400,
          data,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId,
            path: request.url,
            method: request.method,
            statusCode,
          },
        };
      }),
    );
  }

  private isPaginatedResponse(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      (data.hasOwnProperty('documents') ||
        data.hasOwnProperty('items') ||
        data.hasOwnProperty('data')) &&
      (data.hasOwnProperty('total') || data.hasOwnProperty('page'))
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
