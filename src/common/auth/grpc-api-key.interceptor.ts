import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SecretsService } from '../utils/secrets.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GrpcApiKeyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GrpcApiKeyInterceptor.name);
  private readonly isDev: boolean;

  constructor(
    private readonly secretsService: SecretsService,
    private readonly configService: ConfigService,
  ) {
    this.isDev = this.configService.get('NODE_ENV') === 'development';
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const rpc = context.switchToRpc();
    const metadata = rpc.getContext();

    try {
      let apiKey: string;

      // In development, try to use the global API key first
      if (this.isDev) {
        apiKey = await this.secretsService.getSecret('GLOBAL_API_KEY');
        if (apiKey) {
          this.logger.debug('Using global API key for gRPC call');
        }
      }

      // If no global key or not in development, use service-specific key
      if (!apiKey) {
        // Get the target service name from the context
        const serviceName = this.getServiceName(context);
        if (!serviceName) {
          return next.handle();
        }

        apiKey = await this.secretsService.getSecret(
          `${serviceName.toUpperCase()}_API_KEY`,
        );
      }

      if (!apiKey) {
        this.logger.warn('No API key available for gRPC call');
        return next.handle();
      }

      // Add metadata with API key to the gRPC call
      metadata.set('x-api-key', apiKey);
      metadata.set('x-service-request', 'true');
    } catch (error) {
      this.logger.error(`Failed to add API key to gRPC call: ${error.message}`);
    }

    return next.handle();
  }

  private getServiceName(context: ExecutionContext): string | null {
    // Extract service name from the handler metadata
    // Implementation depends on how your gRPC services are structured
    const handler = context.getHandler();
    const controller = context.getClass();

    // This is a simplified example - you'll need to adapt this to your service naming convention
    const controllerName = controller.name
      .replace('Controller', '')
      .toLowerCase();
    return controllerName;
  }
}
