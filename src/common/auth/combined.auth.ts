import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt.auth';
import { ApiKeyGuard } from './apikey.guard';
import { Observable } from 'rxjs';

/**
 * Combined auth guard that allows authentication via either JWT token or API key.
 *
 * This enables endpoints to be accessed by both:
 * - Users with valid JWT tokens (typically from browser sessions)
 * - Services or scripts with valid API keys
 *
 * Usage:
 * @UseGuards(CombinedAuthGuard)
 * @ApiKeyScopes(ApiKeyScope.ServiceAuth)  // Optional - only if API key needs specific scopes
 */
@Injectable()
export class CombinedAuthGuard implements CanActivate {
  private readonly logger = new Logger(CombinedAuthGuard.name);

  constructor(
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyGuard,
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if public route (skipping auth check)
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Try API key authentication first if x-api-key header is present
    if (request.headers['x-api-key'] || request.query?.api_key) {
      return this.apiKeyGuard.canActivate(context);
    }

    // Try JWT authentication if Authorization header or cookies are present
    if (
      request.headers.authorization ||
      request.cookies?.Authentication ||
      request.headers.cookie
    ) {
      return this.jwtAuthGuard.canActivate(context);
    }

    // If neither authentication method is provided, deny access
    this.logger.error('No authentication method provided');
    throw new UnauthorizedException(
      'Authentication required (JWT token or API key)',
    );
  }
}
