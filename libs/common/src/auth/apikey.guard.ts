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
import { ConfigService } from '@nestjs/config';

export const RequireApiKey = () => SetMetadata('requireApiKey', true);
export const ApiKeyScopes = (...scopes: ApiKeyScope[]) =>
  SetMetadata('apiKeyScopes', scopes);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly isDev: boolean;
  private readonly isProduction: boolean;

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.isDev = this.configService.get('NODE_ENV') === 'development';
    this.isProduction = this.configService.get('NODE_ENV') === 'production';

    if (
      this.isDev &&
      !this.configService.get<boolean>('ENFORCE_DEV_SECURITY', true)
    ) {
      this.logger.warn(
        'API key scope checking is relaxed in development mode. ' +
          'Set ENFORCE_DEV_SECURITY=true for production-like security.',
      );
    }
  }

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

      // Check if this is the global dev key
      const isGlobalDevKey =
        this.isDev && apiKeyDoc.metadata?.isGlobalDevKey === true;

      // Check required scopes
      const requiredScopes = this.reflector.get<ApiKeyScope[]>(
        'apiKeyScopes',
        context.getHandler(),
      );

      if (requiredScopes && requiredScopes.length > 0) {
        // Check if we should enforce security even in development
        const enforceDevSecurity = this.configService.get<boolean>(
          'ENFORCE_DEV_SECURITY',
          true,
        );

        // In development with global key, and not enforcing security
        if (isGlobalDevKey && !this.isProduction && !enforceDevSecurity) {
          const missingScopes = requiredScopes.filter(
            (scope) => !apiKeyDoc.scopes.includes(scope),
          );

          if (missingScopes.length > 0) {
            // Log a warning but still allow access
            this.logger.warn(
              `DEV MODE: Global API key missing required scopes: ${missingScopes.join(', ')}. ` +
                'Set ENFORCE_DEV_SECURITY=true to strictly enforce scopes in development.',
            );
          }
        } else {
          // For all other cases (production or enforced dev), strictly check scopes
          const hasAllScopes = requiredScopes.every((scope) =>
            apiKeyDoc.scopes.includes(scope),
          );

          if (!hasAllScopes) {
            const missingScopes = requiredScopes.filter(
              (scope) => !apiKeyDoc.scopes.includes(scope),
            );

            this.logger.warn(
              `API key ${apiKeyDoc._id} missing required scopes: ${missingScopes.join(', ')}`,
            );
            throw new UnauthorizedException('Insufficient API key permissions');
          }
        }
      }

      // Attach API key info to request for controllers
      request.apiKey = {
        id: apiKeyDoc._id,
        ownerId: apiKeyDoc.ownerId,
        name: apiKeyDoc.name,
        scopes: apiKeyDoc.scopes,
        isGlobalDevKey,
      };

      return true;
    } catch (error) {
      this.logger.error(`API key validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid API key');
    }
  }

  private extractApiKey(request: any): string | undefined {
    // Only accept API key from header
    return request.headers['x-api-key'];
  }
}
