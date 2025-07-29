import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard, ApiKeyGuard } from '../common';
import { Reflector } from '@nestjs/core';
import { Observable, from, lastValueFrom } from 'rxjs';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private jwtAuthGuard: JwtAuthGuard,
    private apiKeyGuard: ApiKeyGuard,
    private reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if endpoint is marked as public
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Extract API key if present
    const apiKey = request.headers['x-api-key'] || request.query?.api_key;

    // If API key is present, use API key auth
    if (apiKey) {
      return this.apiKeyGuard.canActivate(context);
    }

    // Otherwise use JWT auth - wrap with lastValueFrom to handle Observable result
    const result = this.jwtAuthGuard.canActivate(context);

    // Handle different return types
    if (result instanceof Observable) {
      return result;
    } else if (result instanceof Promise) {
      return result;
    } else {
      return result;
    }
  }
}
