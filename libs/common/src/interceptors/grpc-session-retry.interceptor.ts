import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
} from '@nestjs/common';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, mergeMap, retryWhen, tap } from 'rxjs/operators';
import { RpcException } from '@nestjs/microservices';
import { ClientsModule, ClientsModuleOptions } from '@nestjs/microservices';

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
  sessionErrors: string[];
}

@Injectable()
export class GrpcSessionRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GrpcSessionRetryInterceptor.name);
  private readonly config: RetryConfig = {
    maxRetries: 5,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    retryableErrors: [
      'UNAVAILABLE',
      'DEADLINE_EXCEEDED',
      'INTERNAL',
      'UNKNOWN',
    ],
    sessionErrors: [
      'Right side of assignment cannot be destructured',
      'session.request',
      'Session closed',
      'Cannot read property',
      'Cannot read properties of null',
      'Cannot read properties of undefined',
      'TypeError: Right side of assignment',
      'stream is not a function',
      'http2Stream',
    ],
  };

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const method = context.getHandler().name;
    const className = context.getClass().name;
    const requestId = Math.random().toString(36).substring(7);

    return next.handle().pipe(
      tap(() => {
        this.logger.debug(
          `[${requestId}] ${className}.${method} completed successfully`,
        );
      }),
      retryWhen((errors) =>
        errors.pipe(
          mergeMap((error, index) => {
            const attempt = index + 1;
            const errorCode = this.extractErrorCode(error);
            const isSessionError = this.isSessionError(error);

            if (attempt > this.config.maxRetries) {
              this.logger.error(
                `[${requestId}] ${className}.${method} failed after ${attempt} attempts. Error: ${errorCode}`,
                error.stack,
              );
              return throwError(() => error);
            }

            if (!this.isRetryableError(errorCode) && !isSessionError) {
              this.logger.error(
                `[${requestId}] ${className}.${method} failed with non-retryable error: ${errorCode}`,
                error.stack,
              );
              return throwError(() => error);
            }

            // Handle session errors with immediate retry
            if (isSessionError) {
              this.logger.warn(
                `[${requestId}] ${className}.${method} detected session error. Forcing immediate retry ${attempt}/${this.config.maxRetries}`,
              );
              // Immediate retry for session errors (no delay)
              return timer(100); // Very short delay to allow session cleanup
            }

            // Handle regular retryable errors
            const delay = Math.min(
              this.config.initialDelay *
                Math.pow(this.config.backoffMultiplier, index),
              this.config.maxDelay,
            );

            this.logger.warn(
              `[${requestId}] ${className}.${method} failed with ${errorCode}. Retrying attempt ${attempt}/${this.config.maxRetries} after ${delay}ms`,
            );

            return timer(delay);
          }),
        ),
      ),
      catchError((error) => {
        const isSessionError = this.isSessionError(error);
        if (isSessionError) {
          this.logger.error(
            `[${requestId}] ${className}.${method} failed permanently with session error`,
            error.stack,
          );
        } else {
          this.logger.error(
            `[${requestId}] ${className}.${method} failed permanently`,
            error.stack,
          );
        }
        return throwError(() => error);
      }),
    );
  }

  private extractErrorCode(error: any): string {
    if (error instanceof RpcException) {
      const errorMessage = error.message;
      const codeMatch = errorMessage.match(/\d+\s+(\w+):/);
      if (codeMatch) {
        return codeMatch[1];
      }
    }
    return error.code || error.name || 'UNKNOWN';
  }

  private isRetryableError(errorCode: string): boolean {
    return this.config.retryableErrors.includes(errorCode);
  }

  private isSessionError(error: any): boolean {
    const errorMessage = error.message || error.toString() || '';
    const stackTrace = error.stack || '';

    return this.config.sessionErrors.some(
      (sessionError) =>
        errorMessage.includes(sessionError) ||
        stackTrace.includes(sessionError),
    );
  }
}
