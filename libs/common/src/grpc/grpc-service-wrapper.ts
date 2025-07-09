import { Injectable, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { GrpcConnectionManager } from './grpc-connection-manager';

export interface GrpcServiceCall<T = any> {
  (...args: any[]): Observable<T>;
}

@Injectable()
export class GrpcServiceWrapper {
  private readonly logger = new Logger(GrpcServiceWrapper.name);

  constructor(private readonly connectionManager: GrpcConnectionManager) {}

  /**
   * Wraps a gRPC service call with session error handling
   * Usage: this.grpcWrapper.call('AUTH_SERVICE', () => this.authService.validateToken(token))
   */
  call<T>(
    serviceName: string,
    serviceCall: () => Observable<T>,
    operationName?: string,
  ): Observable<T> {
    const operation = operationName || 'grpc_call';

    return serviceCall().pipe(
      tap(() => {
        this.connectionManager.recordSuccess(serviceName);
      }),
      catchError((error) => {
        this.connectionManager.recordError(serviceName, error);

        // Enhanced error logging
        this.logger.error(`gRPC call failed for ${serviceName}.${operation}:`, {
          error: error.message,
          stack: error.stack,
          serviceName,
          operation,
          isSessionError: this.isSessionError(error),
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Get a gRPC service with automatic session error handling
   * Usage: const authService = this.grpcWrapper.getService<AuthService>('AUTH_SERVICE', 'Auth');
   */
  getService<T>(
    client: ClientGrpc,
    serviceName: string,
    protoServiceName: string,
  ): T {
    const service = client.getService<T>(protoServiceName);

    // Register the connection with the manager
    this.connectionManager.registerConnection(serviceName, client);

    return service;
  }

  /**
   * Create a safer gRPC service proxy that automatically handles session errors
   */
  createServiceProxy<T extends Record<string, any>>(
    client: ClientGrpc,
    serviceName: string,
    protoServiceName: string,
  ): T {
    const service = this.getService<T>(client, serviceName, protoServiceName);

    // Create a proxy that wraps all service methods
    return new Proxy(service, {
      get: (target, prop: string | symbol) => {
        const original = target[prop as keyof T];

        if (typeof original === 'function') {
          return (...args: any[]) => {
            return this.call(
              serviceName,
              () => original.apply(target, args),
              String(prop),
            );
          };
        }

        return original;
      },
    });
  }

  private isSessionError(error: any): boolean {
    const errorMessage = error.message || error.toString() || '';
    return (
      errorMessage.includes(
        'Right side of assignment cannot be destructured',
      ) ||
      errorMessage.includes('session.request') ||
      errorMessage.includes('Session closed') ||
      errorMessage.includes('http2Stream')
    );
  }
}
