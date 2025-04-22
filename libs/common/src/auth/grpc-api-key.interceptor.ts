import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SecretsService } from '../utils/secrets.service';

@Injectable()
export class GrpcApiKeyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GrpcApiKeyInterceptor.name);
  
  constructor(private readonly secretsService: SecretsService) {}
  
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const rpc = context.switchToRpc();
    const data = rpc.getData();
    
    // Get the service name from the context
    const serviceName = this.getServiceName(context);
    if (!serviceName) {
      return next.handle();
    }
    
    try {
      // Retrieve the appropriate API key for this service-to-service call
      const apiKey = await this.secretsService.getSecret(`${serviceName.toUpperCase()}_API_KEY`);
      
      if (!apiKey) {
        this.logger.warn(`No API key found for service: ${serviceName}`);
        return next.handle();
      }
      
      // Add metadata with API key to the gRPC call
      const metadata = rpc.getContext();
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
    const controllerName = controller.name.replace('Controller', '').toLowerCase();
    return controllerName;
  }
}