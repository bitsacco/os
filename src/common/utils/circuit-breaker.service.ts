import { Injectable, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

/**
 * Options for configuring a circuit breaker
 */
export interface CircuitBreakerOptions<T = any> {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in milliseconds before trying to reset circuit after failure */
  resetTimeout: number;
  /** Optional fallback response to return when circuit is open */
  fallbackResponse?: T;
}

/**
 * Service implementing the Circuit Breaker pattern for resilient service calls
 *
 * This service provides circuit breaking capabilities for service calls to
 * prevent cascading failures and provide graceful degradation when
 * downstream services are unavailable.
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<
    string,
    {
      failures: number;
      lastFailure: number;
      state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      options: CircuitBreakerOptions<any>;
    }
  > = new Map();

  /**
   * Execute a service call with circuit breaking
   *
   * @param serviceKey Unique identifier for the service/method
   * @param serviceCall The Observable representing the service call
   * @param options Circuit breaker configuration
   * @returns Observable with the service response or fallback
   */
  execute<T>(
    serviceKey: string,
    serviceCall: Observable<T>,
    options: CircuitBreakerOptions<T>,
  ): Observable<T> {
    this.initCircuit(serviceKey, options);
    const circuit = this.circuits.get(serviceKey);

    // Check if circuit is OPEN
    if (circuit.state === 'OPEN') {
      const now = Date.now();
      const timeSinceLastFailure = now - circuit.lastFailure;

      if (timeSinceLastFailure > circuit.options.resetTimeout) {
        // Move to HALF_OPEN
        circuit.state = 'HALF_OPEN';
        this.logger.log(`Circuit for ${serviceKey} is now HALF_OPEN`);
      } else {
        // Still OPEN, return fallback
        this.logger.warn(`Circuit for ${serviceKey} is OPEN, using fallback`);
        return options.fallbackResponse
          ? new Observable<T>((subscriber) => {
              subscriber.next(options.fallbackResponse as T);
              subscriber.complete();
            })
          : throwError(() => new Error(`Service ${serviceKey} is unavailable`));
      }
    }

    // Execute the call
    return serviceCall.pipe(
      catchError((error) => {
        this.recordFailure(serviceKey);
        return throwError(() => error);
      }),
      switchMap((result: T) => {
        // Success, reset circuit if it was HALF_OPEN
        if (circuit.state === 'HALF_OPEN') {
          circuit.state = 'CLOSED';
          circuit.failures = 0;
          this.logger.log(`Circuit for ${serviceKey} is now CLOSED`);
        }
        return new Observable<T>((subscriber) => {
          subscriber.next(result);
          subscriber.complete();
        });
      }),
    );
  }

  /**
   * Initialize a circuit if it doesn't exist
   */
  private initCircuit<T>(
    serviceKey: string,
    options: CircuitBreakerOptions<T>,
  ) {
    if (!this.circuits.has(serviceKey)) {
      this.circuits.set(serviceKey, {
        failures: 0,
        lastFailure: 0,
        state: 'CLOSED',
        options,
      });
    }
  }

  /**
   * Record a failure for a service and update circuit state
   */
  private recordFailure(serviceKey: string) {
    const circuit = this.circuits.get(serviceKey);
    circuit.failures += 1;
    circuit.lastFailure = Date.now();

    if (
      circuit.failures >= circuit.options.failureThreshold &&
      circuit.state === 'CLOSED'
    ) {
      circuit.state = 'OPEN';
      this.logger.warn(
        `Circuit for ${serviceKey} is now OPEN after ${circuit.failures} failures`,
      );
    }
  }
}
