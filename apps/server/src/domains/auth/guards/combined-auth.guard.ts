import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyGuard } from './apikey.guard';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check for Bearer token
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        return (await this.jwtGuard.canActivate(context)) as boolean;
      } catch (error) {
        // JWT authentication failed, try API key
      }
    }

    // Check for API key
    const apiKey = request.headers['x-api-key'];
    if (apiKey) {
      try {
        return (await this.apiKeyGuard.canActivate(context)) as boolean;
      } catch (error) {
        // API key authentication failed
      }
    }

    // Both authentication methods failed
    throw new (require('@nestjs/common').UnauthorizedException)(
      'Authentication required: provide either Bearer token or x-api-key header',
    );
  }
}
