import {
  Injectable,
  NestMiddleware,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * Middleware to protect against CSRF attacks
 * Implements double-submit cookie pattern for enhanced security
 */
@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfProtectionMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Skip for safe methods that don't modify state
    if (
      req.method === 'GET' ||
      req.method === 'HEAD' ||
      req.method === 'OPTIONS'
    ) {
      return next();
    }

    // Verify CSRF for any authentication type using cookies (not just JWT)
    if (this.usesCookieAuthentication(req)) {
      // Validate CSRF token using timing-safe comparison
      const csrfToken = req.headers['x-csrf-token'] as string;

      if (!csrfToken) {
        this.logger.warn('Missing CSRF token in request');
        throw new UnauthorizedException('Missing CSRF token');
      }

      // Get the expected token from the CSRF cookie
      const csrfCookie = this.extractCsrfCookie(req);
      if (!csrfCookie) {
        this.logger.warn('Missing CSRF cookie in request');
        throw new UnauthorizedException('CSRF validation failed');
      }

      // Use timing-safe comparison to prevent timing attacks
      const isValid = this.timingSafeEqual(csrfToken, csrfCookie);
      if (!isValid) {
        this.logger.warn('CSRF token mismatch');
        throw new UnauthorizedException('Invalid CSRF token');
      }
    }

    next();
  }

  /**
   * Check if the request uses any form of cookie-based authentication
   */
  private usesCookieAuthentication(req: Request): boolean {
    return !!(req.cookies?.Authentication || this.extractAuthCookie(req));
  }

  /**
   * Extract Authentication cookie from Cookie header if req.cookies is not parsed
   */
  private extractAuthCookie(req: Request): string | null {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    return cookies['Authentication'] || null;
  }

  /**
   * Extract CSRF cookie from request
   */
  private extractCsrfCookie(req: Request): string | null {
    // Try parsed cookies first
    if (req.cookies?.['XSRF-TOKEN']) {
      return req.cookies['XSRF-TOKEN'];
    }

    // Fall back to parsing Cookie header
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    return cookies['XSRF-TOKEN'] || null;
  }

  /**
   * Perform timing-safe comparison of strings
   */
  private timingSafeEqual(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a, 'utf8'),
        Buffer.from(b, 'utf8'),
      );
    } catch (error) {
      this.logger.error(`Error during CSRF token comparison: ${error.message}`);
      return false;
    }
  }
}
