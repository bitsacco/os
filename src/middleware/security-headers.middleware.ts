import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Middleware to add security headers to all responses
 *
 * This middleware adds various security headers to protect against
 * common web vulnerabilities such as XSS, clickjacking, and MIME-type sniffing.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityHeadersMiddleware.name);
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';

    // Log the security headers configuration on startup
    this.logger.log(
      `Security headers middleware initialized (env: ${this.isProduction ? 'production' : 'development'})`,
    );
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Generate CSP nonce for this request
    const nonce = this.generateNonce();

    // Store nonce in request object to make it available to templates
    req['cspNonce'] = nonce;

    // Protect against content type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking by restricting iframe usage
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable browser XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Force HTTPS with strict transport security
    // Only in production to avoid issues in development
    if (this.isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    // Build Content Security Policy
    const cspDirectives = this.buildCspDirectives(nonce);
    res.setHeader('Content-Security-Policy', cspDirectives);

    // Set referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Disable browser features as needed
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), bluetooth=(), magnetometer=(), gyroscope=()',
    );

    // For older browsers that don't support Permissions-Policy
    res.setHeader(
      'Feature-Policy',
      'camera none; microphone none; geolocation none; payment none; usb none',
    );

    // Add Cross-Origin policies
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Add security header to prevent browsers from detecting the application framework
    res.setHeader('X-Powered-By', 'Bitsacco OS');

    next();
  }

  /**
   * Generate a cryptographically secure nonce
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Build Content Security Policy directives
   * @param nonce Cryptographic nonce to use for the request
   */
  private buildCspDirectives(nonce: string): string {
    const directives = [
      // Default policy for all resources
      `default-src 'self'`,

      // Script execution restrictions
      `script-src 'self' 'nonce-${nonce}'`,

      // Block loading of plugins
      `object-src 'none'`,

      // Image loading restrictions
      `img-src 'self' data:`,

      // Style loading restrictions
      // Using nonce instead of unsafe-inline
      `style-src 'self' 'nonce-${nonce}'`,

      // Font loading restrictions
      `font-src 'self'`,

      // Form submission restrictions
      `form-action 'self'`,

      // Frame restrictions
      `frame-ancestors 'none'`,

      // Disallow mixed content
      `upgrade-insecure-requests`,

      // Base URI restriction
      `base-uri 'self'`,

      // Block loading resources from external sites via frames
      `frame-src 'self'`,
    ];

    // Add reporting in production
    if (this.isProduction) {
      const reportUri = this.configService.get<string>('CSP_REPORT_URI');
      if (reportUri) {
        directives.push(`report-uri ${reportUri}`);
      }
    } else {
      // In development, allow websocket connections for hot reloading
      directives.push(`connect-src 'self' ws: wss:`);
    }

    return directives.join('; ');
  }
}
