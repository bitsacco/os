import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RpcException } from '@nestjs/microservices';
import { CoreMetricsService } from '../monitoring/core.metrics';

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly metrics?: CoreMetricsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Default status and error message
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details = null;

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      const error = exception.getResponse();
      status = exception.getStatus();
      message =
        typeof error === 'string'
          ? error
          : error['message'] || exception.message;
      code = this.mapHttpStatusToCode(status);
      details = typeof error === 'object' ? error['error'] : null;
    } else if (exception instanceof RpcException) {
      // Handle gRPC exceptions
      const error = exception.getError();
      status = this.mapGrpcStatusToHttp(error['code'] || 13); // Default to INTERNAL
      message = error['message'] || 'Service error';
      code = error['code'] ? `GRPC_${error['code']}` : 'SERVICE_ERROR';
      details = error['details'] || null;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log the error
    this.logger.error(
      `${request.method} ${request.url} - ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Record error metrics if available
    if (this.metrics) {
      this.metrics.recordError(
        request.url,
        code,
        exception instanceof RpcException
          ? this.extractServiceName(request.url)
          : undefined,
      );
    }

    // Structure the error response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      code,
      details,
    });
  }

  // Map HTTP status codes to consistent error codes
  private mapHttpStatusToCode(status: number): string {
    const codeMap = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };

    return codeMap[status] || 'UNKNOWN_ERROR';
  }

  // Map gRPC status codes to HTTP status codes
  private mapGrpcStatusToHttp(grpcStatus: number): number {
    const statusMap = {
      0: HttpStatus.OK,
      1: HttpStatus.INTERNAL_SERVER_ERROR, // CANCELLED
      2: HttpStatus.INTERNAL_SERVER_ERROR, // UNKNOWN
      3: HttpStatus.BAD_REQUEST, // INVALID_ARGUMENT
      4: HttpStatus.REQUEST_TIMEOUT, // DEADLINE_EXCEEDED
      5: HttpStatus.NOT_FOUND, // NOT_FOUND
      6: HttpStatus.CONFLICT, // ALREADY_EXISTS
      7: HttpStatus.FORBIDDEN, // PERMISSION_DENIED
      8: HttpStatus.PRECONDITION_FAILED, // RESOURCE_EXHAUSTED
      9: HttpStatus.PRECONDITION_FAILED, // FAILED_PRECONDITION
      10: HttpStatus.CONFLICT, // ABORTED
      11: HttpStatus.BAD_REQUEST, // OUT_OF_RANGE
      12: HttpStatus.NOT_IMPLEMENTED, // UNIMPLEMENTED
      13: HttpStatus.INTERNAL_SERVER_ERROR, // INTERNAL
      14: HttpStatus.SERVICE_UNAVAILABLE, // UNAVAILABLE
      15: HttpStatus.INTERNAL_SERVER_ERROR, // DATA_LOSS
      16: HttpStatus.UNAUTHORIZED, // UNAUTHENTICATED
    };

    return statusMap[grpcStatus] || HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private extractServiceName(url: string): string {
    // Extract service name from URL path
    const parts = url.split('/');
    return parts.length > 1 ? parts[1] : 'unknown';
  }
}
