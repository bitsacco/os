import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

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
      `Security headers middleware initialized (env: ${this.isProduction ? 'production' : 'development'})`
    );
  }
  
  use(req: Request, res: Response, next: NextFunction) {
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
        'max-age=31536000; includeSubDomains'
      );
    }
    
    // Add Content Security Policy in production
    if (this.isProduction) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'"
      );
    }
    
    // Set referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Disable browser features as needed
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
    
    // Add Cross-Origin policies
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    
    next();
  }
}