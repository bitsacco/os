import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * Middleware to protect against Cross-Site Request Forgery (CSRF) attacks.
 * 
 * This middleware checks for a CSRF token in requests that use cookie-based authentication.
 * It skips the check for GET requests and requests that don't use cookie authentication.
 */
@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Skip for non-mutation requests
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    
    // Skip if not using cookie authentication
    if (!req.cookies?.Authentication) {
      return next();
    }
    
    const csrfToken = req.headers['x-csrf-token'] as string;
    if (!csrfToken) {
      throw new UnauthorizedException('CSRF token is required');
    }
    
    if (!this.validateCsrfToken(csrfToken, req.cookies.Authentication)) {
      throw new UnauthorizedException('Invalid CSRF token');
    }
    
    next();
  }
  
  /**
   * Validates the CSRF token using a timing-safe comparison
   */
  private validateCsrfToken(csrfToken: string, authToken: string): boolean {
    try {
      // The CSRF token should be a hash derived from the auth token
      // This ensures the CSRF token is tied to the user's session
      const expectedToken = this.generateCsrfTokenForAuth(authToken);
      
      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(csrfToken),
        Buffer.from(expectedToken)
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Generates a CSRF token based on the auth token
   * This method can be exposed publicly to generate tokens for the client
   */
  public generateCsrfTokenForAuth(authToken: string): string {
    // Create a derived token that doesn't expose the JWT
    const hash = crypto.createHash('sha256');
    hash.update(authToken);
    return hash.digest('hex');
  }
}