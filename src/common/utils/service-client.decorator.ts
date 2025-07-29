import { catchError, Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

/**
 * Decorator for handling service client errors consistently
 *
 * This decorator wraps a method that returns an Observable and adds error handling
 * to transform any errors into a consistent RpcException format.
 */
export function HandleServiceErrors() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args);

      if (result instanceof Observable) {
        return result.pipe(
          catchError((error) => {
            // Transform error to RpcException if it's not already
            if (!(error instanceof RpcException)) {
              error = new RpcException({
                code: error.code || 13, // Default to INTERNAL
                message: error.message || 'Service error',
                details: error.details || null,
              });
            }
            return throwError(() => error);
          }),
        );
      }

      return result;
    };

    return descriptor;
  };
}
