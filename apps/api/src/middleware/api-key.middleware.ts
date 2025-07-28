import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '@bitsacco/common';

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiKeyMiddleware.name);
  private readonly publicPaths: string[] = ['/health', '/metrics', '/docs'];

  constructor(private readonly apiKeyService: ApiKeyService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip validation for public endpoints
    if (this.isPublicPath(req.path)) {
      return next();
    }

    // Extract API key from headers or query
    const apiKey = this.extractApiKey(req);

    // If there's an API key, validate it
    if (apiKey) {
      try {
        const apiKeyDoc = await this.apiKeyService.validateApiKey(apiKey);

        // Add API key info to request for downstream handlers
        req['apiKey'] = {
          id: apiKeyDoc._id,
          userId: apiKeyDoc.userId,
          name: apiKeyDoc.name,
          scopes: apiKeyDoc.scopes,
        };

        this.logger.debug(`Valid API key used for path: ${req.path}`);
      } catch {
        this.logger.warn(`Invalid API key used for path: ${req.path}`);
        return res.status(401).json({
          statusCode: 401,
          message: 'Invalid or expired API key',
          error: 'Unauthorized',
        });
      }
    }

    // Allow requests to proceed (they may use JWT auth or be public)
    next();
  }

  private isPublicPath(path: string): boolean {
    return this.publicPaths.some((prefix) => path.startsWith(prefix));
  }

  private extractApiKey(req: Request): string | undefined {
    // Try header first (preferred method)
    const headerKey = req.headers['x-api-key'] as string;
    if (headerKey) {
      return headerKey;
    }

    // Try Authorization header with Bearer scheme
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer bsk_')) {
      return authHeader.substring(7); // Remove "Bearer " prefix
    }

    // Try query parameter as fallback (not recommended for production)
    const queryKey = req.query?.api_key as string;
    if (queryKey) {
      this.logger.warn(
        'API key passed in query parameter - consider using headers instead',
      );
      return queryKey;
    }

    return undefined;
  }
}
