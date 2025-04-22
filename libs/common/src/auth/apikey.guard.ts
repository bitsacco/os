import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './apikey.service';
import { ApiKeyScope } from '../database/apikey.schema';

export const RequireApiKey = () => SetMetadata('requireApiKey', true);
export const ApiKeyScopes = (...scopes: ApiKeyScope[]) => 
  SetMetadata('apiKeyScopes', scopes);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireApiKey = this.reflector.get<boolean>(
      'requireApiKey',
      context.getHandler(),
    );

    if (!requireApiKey) {
      return true; // API key not required for this endpoint
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      this.logger.warn('API key missing from request');
      throw new UnauthorizedException('API key required');
    }

    try {
      const apiKeyDoc = await this.apiKeyService.validateApiKey(apiKey);
      
      // Check required scopes
      const requiredScopes = this.reflector.get<ApiKeyScope[]>(
        'apiKeyScopes',
        context.getHandler(),
      );
      
      if (requiredScopes && requiredScopes.length > 0) {
        const hasAllScopes = requiredScopes.every(scope => 
          apiKeyDoc.scopes.includes(scope)
        );
        
        if (!hasAllScopes) {
          this.logger.warn(
            `API key ${apiKeyDoc._id} missing required scopes: ${requiredScopes}`,
          );
          throw new UnauthorizedException('Insufficient API key permissions');
        }
      }
      
      // Attach API key info to request for controllers
      request.apiKey = {
        id: apiKeyDoc._id,
        ownerId: apiKeyDoc.ownerId,
        name: apiKeyDoc.name,
        scopes: apiKeyDoc.scopes,
      };
      
      return true;
    } catch (error) {
      this.logger.error(`API key validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid API key');
    }
  }

  private extractApiKey(request: any): string | undefined {
    // Try header first (preferred method)
    const headerKey = request.headers['x-api-key'];
    if (headerKey) {
      return headerKey;
    }
    
    // Try query parameter as fallback
    const queryKey = request.query?.api_key;
    if (queryKey) {
      return queryKey;
    }
    
    return undefined;
  }
}