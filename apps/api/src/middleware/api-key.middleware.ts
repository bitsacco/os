import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '@bitsacco/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiKeyMiddleware.name);
  private readonly publicPaths: string[] = ['/health', '/metrics'];
  private readonly docsEnabled: boolean;

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly configService: ConfigService,
  ) {
    // Determine if docs should be public based on environment
    const environment = this.configService.get('NODE_ENV', 'development');
    const enableDocsInProduction =
      this.configService.get('ENABLE_SWAGGER_DOCS') === 'false';

    // Only enable docs if we're not in production or if explicitly enabled
    this.docsEnabled = environment !== 'production' || enableDocsInProduction;

    // If docs are enabled, add them to the public paths
    if (this.docsEnabled) {
      this.publicPaths.push('/docs');
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip validation for public endpoints
    if (this.isPublicPath(req.path)) {
      return next();
    }

    // Check if this is an internal service request
    const isInternalRequest = this.isInternalServiceRequest(req);

    // Extract API key from headers or query
    const apiKey = this.extractApiKey(req);

    // Internal service requests must have an API key
    if (isInternalRequest && !apiKey) {
      this.logger.warn(`Internal service request without API key: ${req.path}`);
      return res.status(401).json({
        statusCode: 401,
        message: 'API key required for service communication',
        error: 'Unauthorized',
      });
    }

    // If there's an API key, validate it regardless of request type
    if (apiKey) {
      try {
        const apiKeyDoc = await this.apiKeyService.validateApiKey(apiKey);

        // Add API key info to request for downstream handlers
        req['apiKey'] = {
          id: apiKeyDoc._id,
          ownerId: apiKeyDoc.ownerId,
          name: apiKeyDoc.name,
          scopes: apiKeyDoc.scopes,
        };

        return next();
      } catch (error) {
        this.logger.warn(`Invalid API key used for path: ${req.path}`);
        return res.status(401).json({
          statusCode: 401,
          message: 'Invalid or expired API key',
          error: 'Unauthorized',
        });
      }
    }

    // Allow requests without API key to proceed (they may use JWT auth)
    next();
  }

  private isPublicPath(path: string): boolean {
    return this.publicPaths.some((prefix) => path.startsWith(prefix));
  }

  private isInternalServiceRequest(req: Request): boolean {
    // Check headers that indicate internal service communication
    return (
      req.headers['x-service-request'] === 'true' ||
      req.headers['x-internal-request'] === 'true'
    );
  }

  private extractApiKey(req: Request): string | undefined {
    // Try header first (preferred method)
    const headerKey = req.headers['x-api-key'] as string;
    if (headerKey) {
      return headerKey;
    }

    // Try query parameter as fallback
    const queryKey = req.query?.api_key as string;
    if (queryKey) {
      return queryKey;
    }

    return undefined;
  }
}
