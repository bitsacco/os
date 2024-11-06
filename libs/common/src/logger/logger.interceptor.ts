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

    console.log(`[HTTP Request] ${method} ${url}`);
    console.log('Request Body:', JSON.stringify(request.body, null, 2));

    return next.handle().pipe(
      tap((data) => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;
        console.log(
          `[HTTP Response] ${method} ${url} ${response.statusCode} - ${delay}ms`,
        );
        console.log('Response Body:', JSON.stringify(data, null, 2));
      }),
    );
  }
}
