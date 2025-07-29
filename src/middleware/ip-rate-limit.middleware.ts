import { Request, Response, NextFunction } from 'express';
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Middleware to apply IP-based rate limiting for all requests,
 * especially protecting anonymous endpoints from abuse.
 */
@Injectable()
export class IpRateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpRateLimitMiddleware.name);
  private readonly enabled: boolean;
  private readonly limit: number;
  private readonly windowSeconds: number;
  private readonly burstLimit: number;
  private readonly rateLimits = new Map<string, RateLimitEntry>();

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>(
      'IP_RATE_LIMIT_ENABLED',
      true,
    );
    this.limit = this.configService.get<number>('IP_RATE_LIMIT', 30);
    this.windowSeconds = this.configService.get<number>(
      'IP_RATE_LIMIT_WINDOW',
      60,
    );
    this.burstLimit = this.configService.get<number>('IP_RATE_LIMIT_BURST', 10);

    this.logger.log(
      `IP rate limiting ${this.enabled ? 'enabled' : 'disabled'} ` +
        `(${this.limit}/${this.windowSeconds}s with ${this.burstLimit} burst)`,
    );

    // Clean up expired entries every 5 minutes
    if (this.enabled) {
      setInterval(() => this.cleanupExpiredEntries(), 5 * 60 * 1000);
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    if (!this.enabled) {
      return next();
    }

    // Get client IP address
    const ip = this.getClientIp(req);

    // Skip rate limiting for trusted IPs and internal requests
    if (this.isTrustedIp(ip)) {
      return next();
    }

    try {
      // Check rate limit
      const now = Date.now();
      const windowMs = this.windowSeconds * 1000;

      let entry = this.rateLimits.get(ip);

      // If no entry or window expired, create new entry
      if (!entry || now >= entry.resetAt) {
        entry = {
          count: 0,
          resetAt: now + windowMs,
        };
        this.rateLimits.set(ip, entry);
      }

      const totalLimit = this.limit + this.burstLimit;
      const allowed = entry.count < totalLimit;

      if (allowed) {
        entry.count++;
      }

      const remaining = Math.max(0, totalLimit - entry.count);
      const resetAtSeconds = Math.floor(entry.resetAt / 1000);

      // Add rate limit headers to response
      res.setHeader('X-RateLimit-Limit', totalLimit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetAtSeconds);

      // If rate limit exceeded, return 429 Too Many Requests
      if (!allowed) {
        this.logger.warn(`Rate limit exceeded for IP ${this.maskIp(ip)}`);

        res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
        res.status(429).json({
          statusCode: 429,
          message: 'Too many requests, please try again later',
          error: 'Too Many Requests',
        });
        return;
      }

      // Request allowed, continue to next middleware
      next();
    } catch (error) {
      // Log error but continue processing the request
      this.logger.error(`Error in IP rate limiting: ${error.message}`);
      next();
    }
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(req: Request): string {
    // Try X-Forwarded-For header first (when behind proxy/load balancer)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can be a comma-separated list; take the first (client) IP
      const ips = (
        Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
      ).split(',');
      const clientIp = ips[0].trim();
      return clientIp;
    }

    // Fallback to other headers or connection remote address
    return (
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      '127.0.0.1'
    );
  }

  /**
   * Check if IP is trusted (bypass rate limiting)
   */
  private isTrustedIp(ip: string): boolean {
    // Allow localhost and internal IPs to bypass rate limiting
    if (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('192.168.')
    ) {
      return true;
    }

    // Check against configured trusted IPs
    const trustedIps = this.configService.get<string>(
      'IP_RATE_LIMIT_TRUSTED',
      '',
    );
    if (trustedIps) {
      const trustedList = trustedIps.split(',').map((ip) => ip.trim());
      return trustedList.includes(ip);
    }

    return false;
  }

  /**
   * Mask IP address for logging (privacy protection)
   */
  private maskIp(ip: string): string {
    if (ip.includes(':')) {
      // IPv6 - mask last 4 segments
      return ip.replace(/:[^:]+:[^:]+:[^:]+:[^:]+$/, ':****:****:****:****');
    } else {
      // IPv4 - mask last octet
      return ip.replace(/\d+$/, '***');
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [ip, entry] of this.rateLimits.entries()) {
      if (now >= entry.resetAt) {
        this.rateLimits.delete(ip);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired IP rate limit entries`);
    }
  }
}
