import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ApiKeyService } from './apikey.service';
import { ApiKeyScope } from '../database/apikey.schema';

@Injectable()
export class GrpcApiKeyMiddleware {
  private readonly logger = new Logger(GrpcApiKeyMiddleware.name);
  
  constructor(private readonly apiKeyService: ApiKeyService) {}
  
  async use(data: unknown, context: any, next: () => Promise<any>) {
    const metadata = context.getGrpcContext();
    
    // Extract API key from metadata
    const apiKey = metadata.get('x-api-key')[0];
    
    if (!apiKey) {
      this.logger.warn('gRPC call without API key');
      throw new RpcException('API key required');
    }
    
    try {
      // Validate the API key
      const apiKeyDoc = await this.apiKeyService.validateApiKey(apiKey);
      
      // Check if key has the required service scope
      const serviceName = this.getServiceName(context);
      const requiredScope = `service:${serviceName}` as ApiKeyScope;
      
      if (!apiKeyDoc.scopes.includes(requiredScope)) {
        this.logger.warn(`API key missing required scope: ${requiredScope}`);
        throw new RpcException('Insufficient API key permissions');
      }
      
      // Add API key info to context for handlers
      context.apiKey = {
        id: apiKeyDoc._id,
        ownerId: apiKeyDoc.ownerId,
        name: apiKeyDoc.name,
        scopes: apiKeyDoc.scopes,
      };
      
      return next();
    } catch (error) {
      this.logger.error(`API key validation failed: ${error.message}`);
      throw new RpcException('Invalid or expired API key');
    }
  }
  
  private getServiceName(context: any): string {
    // Extract service name from context
    // Implementation depends on your gRPC service structure
    return context.service.toLowerCase();
  }
}