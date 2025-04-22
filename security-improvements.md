# Security Improvements for Bitsacco OS

This document outlines the security improvements implemented to address identified vulnerabilities.

## 1. Redis-Based Distributed Rate Limiting

**Problem:** In-memory rate limiting could be bypassed through distributed attacks since rate limit data was not shared across instances.

**Solution:** Implemented a Redis-based distributed rate limiting service:

- Created a reusable `DistributedRateLimitService` in the common library that:
  - Uses Redis for centralized rate limit tracking
  - Supports configurable limits, window sizes, and burst capacities
  - Properly handles cleanup of expired rate limits
  - Provides atomic increment operations for consistent enforcement
  
- Updated rate limiting in auth service:
  - Replaced in-memory Map with Redis storage
  - Maintained the same 5 attempts per 15 minutes policy

- Updated notification service rate limiting:
  - Preserved channel and importance-based rate limiting
  - Used distributed backend for enforcement
  - Maintained existing configurations and limits

## 2. API Gateway Protection

**Problem:** Inconsistent security across endpoints with no centralized rate limiting or security headers.

**Solutions:**

### Global Rate Limiting

- Implemented ThrottlerModule with Redis storage for distributed rate limiting
- Set up configurable limits via environment variables (`THROTTLE_TTL` and `THROTTLE_LIMIT`)
- Applied global guard for all routes

### Security Headers Middleware

- Added a comprehensive security headers middleware that:
  - Sets `X-Content-Type-Options: nosniff` to prevent MIME type sniffing
  - Sets `X-Frame-Options: DENY` to prevent clickjacking
  - Enables browser XSS protection with `X-XSS-Protection: 1; mode=block`
  - Adds Strict Transport Security (HSTS) in production
  - Implements Content Security Policy in production
  - Sets Referrer Policy and Permissions Policy headers
  - Configures Cross-Origin policies for safe resource sharing

## 3. Redis Security Enhancements

**Problem:** The Redis service had no authentication, persistence, or resource limits.

**Solution:** Enhanced Redis configuration:

- Added password authentication
- Implemented data persistence with AOF (Append Only File)
- Configured memory limits (256MB) with LRU eviction policy
- Added container health checks
- Created a persistent volume for data storage
- Added TLS support configuration option

## Configuration Updates

- Added environment variable validation for new configuration options
- Made Redis password configurable but defaulting to a secure value
- Added TLS option for Redis connections in production environments
- Updated all Redis clients to use the password configuration

## Benefits

1. **Distributed Attack Protection**: Rate limits are now enforced across all instances
2. **Improved Web Security**: Standard security headers protect against common web vulnerabilities
3. **Enhanced Data Protection**: Redis security prevents unauthorized access to cached data
4. **Resource Management**: Memory limits and eviction policies prevent resource exhaustion
5. **High Availability**: Persistent storage and health checks improve reliability

## Usage Notes

- When deploying to production:
  - Set a strong `REDIS_PASSWORD` environment variable
  - Consider enabling `REDIS_TLS=true` for encrypted communication
  - Adjust `THROTTLE_TTL` and `THROTTLE_LIMIT` based on expected traffic patterns