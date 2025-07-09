import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ClientGrpc, ClientProxy } from '@nestjs/microservices';
import { Observable, Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface ConnectionHealth {
  serviceName: string;
  isHealthy: boolean;
  lastError: Date | null;
  consecutiveErrors: number;
}

@Injectable()
export class GrpcConnectionManager implements OnModuleDestroy {
  private readonly logger = new Logger(GrpcConnectionManager.name);
  private readonly connections = new Map<string, ClientGrpc>();
  private readonly connectionHealth = new Map<string, ConnectionHealth>();
  private readonly destroy$ = new Subject<void>();

  onModuleDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  registerConnection(serviceName: string, client: ClientGrpc): void {
    this.connections.set(serviceName, client);
    this.connectionHealth.set(serviceName, {
      serviceName,
      isHealthy: true,
      lastError: null,
      consecutiveErrors: 0,
    });

    this.logger.debug(`Registered gRPC connection for service: ${serviceName}`);
  }

  getConnection(serviceName: string): ClientGrpc | undefined {
    return this.connections.get(serviceName);
  }

  recordError(serviceName: string, error: any): void {
    const health = this.connectionHealth.get(serviceName);
    if (health) {
      health.consecutiveErrors++;
      health.lastError = new Date();
      health.isHealthy = health.consecutiveErrors < 3;

      this.logger.warn(
        `Service ${serviceName} error count: ${health.consecutiveErrors}`,
        error.message,
      );

      // If we detect session errors, attempt to reset the connection
      if (this.isSessionError(error)) {
        this.resetConnection(serviceName);
      }
    }
  }

  recordSuccess(serviceName: string): void {
    const health = this.connectionHealth.get(serviceName);
    if (health) {
      health.consecutiveErrors = 0;
      health.isHealthy = true;
      health.lastError = null;
    }
  }

  private resetConnection(serviceName: string): void {
    this.logger.warn(`Resetting connection for service: ${serviceName}`);

    const client = this.connections.get(serviceName);
    if (client) {
      try {
        // Try to close the connection if it has a close method
        if (typeof (client as any).close === 'function') {
          (client as any).close();
        }
        // Remove the connection from our cache to force recreation
        this.connections.delete(serviceName);
      } catch (error) {
        this.logger.error(
          `Error closing connection for ${serviceName}:`,
          error,
        );
      }
    }

    // Schedule reconnection after a short delay
    timer(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.logger.debug(`Reconnection scheduled for service: ${serviceName}`);
        // The connection will be recreated on next request
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

  getConnectionHealth(): Map<string, ConnectionHealth> {
    return new Map(this.connectionHealth);
  }

  isServiceHealthy(serviceName: string): boolean {
    const health = this.connectionHealth.get(serviceName);
    return health ? health.isHealthy : false;
  }
}
