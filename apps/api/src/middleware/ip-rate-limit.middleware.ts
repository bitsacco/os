import { Request, Response, NextFunction } from 'express';
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { DistributedRateLimitService } from '@bitsacco/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(
    private readonly rateLimitService: DistributedRateLimitService,
    private readonly configService: ConfigService,
  ) {
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
      // Check if request should be rate limited
      const result = await this.rateLimitService.checkRateLimit(
        ip,
        'anonymous',
        {
          limit: this.limit,
          windowSeconds: this.windowSeconds,
          burstLimit: this.burstLimit,
        },
      );

      // Add rate limit headers to response
      res.setHeader('X-RateLimit-Limit', this.limit + this.burstLimit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      // If rate limit exceeded, return 429 Too Many Requests
      if (!result.allowed) {
        this.logger.warn(`Rate limit exceeded for IP ${this.maskIp(ip)}`);

        res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
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
}
