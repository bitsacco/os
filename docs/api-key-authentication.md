# API Key Authentication in Bitsacco

This document explains how API key authentication works in Bitsacco and how to use it in both development and production environments.

## Overview

Bitsacco uses a dual authentication approach:
- **JWT tokens** for user authentication
- **API keys** for service-to-service and machine-to-machine authentication

## Development Environment Setup

For development, we use a simplified approach with a single global API key that has access to all services.

### API Key Management Scripts

Bitsacco provides several npm scripts to manage API keys:

| Script | Description |
| `bun apikey:create` | Create a new API key with custom scopes |
| `bun apikey:list` | List all API keys in the database |
| `bun apikey:revoke` | Revoke an existing API key |

### Generate a Global Development API Key

```bash
# Generate the global development API key
bun apikey:generate
```

This script:
1. Generates a secure API key with the prefix `bsk_dev_global_`
2. Stores it in the MongoDB database with all necessary scopes
3. Updates all service `.dev.env` files with the key

### Testing the API Key

```bash
# Test the API key with the API gateway
bun apikey:test

# Test both JWT and API key authentication
bun apikey:test:combined
```

## Using API Keys in Your Code

### Accessing Protected Endpoints

Add the API key to the request headers:

```typescript
// HTTP request with API key
const response = await axios.get('http://api:4000/some-endpoint', {
  headers: {
    'x-api-key': process.env.GLOBAL_API_KEY,
  },
});
```

### Protecting Your Endpoints

Use the ApiKeyGuard to require API key authentication:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireApiKey, ApiKeyScopes, ApiKeyScope, ApiKeyGuard } from '@bitsacco/common';

@Controller('your-endpoint')
export class YourController {
  @Get()
  @RequireApiKey()
  @ApiKeyScopes(ApiKeyScope.ServiceAuth)
  @UseGuards(ApiKeyGuard)
  async protectedEndpoint() {
    // This endpoint requires a valid API key with ServiceAuth scope
    return { success: true };
  }
}
```

### Support Both JWT and API Key Authentication

Use the CombinedAuthGuard to support both authentication methods:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { CombinedAuthGuard, ApiKeyScopes, ApiKeyScope } from '@bitsacco/common';

@Controller('dual-auth')
export class YourController {
  @Get()
  @UseGuards(CombinedAuthGuard)
  @ApiKeyScopes(ApiKeyScope.ServiceAuth) // Required scopes if using API key
  async dualAuthEndpoint() {
    // This endpoint accepts either JWT token or API key
    return { success: true };
  }
}
```

The CombinedAuthGuard works by:
1. Checking if the request includes an API key header or query parameter
2. If not, it falls back to JWT token authentication
3. If neither credential is provided, it returns an authentication error

To test the combined authentication:

```bash
# Test both authentication methods
bun apikey:test:combined
```

### Service-to-Service Communication

For service-to-service communication, include the API key in your HTTP headers:

```typescript
// HTTP request with API key for service-to-service communication
const response = await axios.get('http://other-service:4000/endpoint', {
  headers: {
    'x-api-key': process.env.SERVICE_API_KEY,
  },
});
```

## API Key Scopes

Scopes are used to restrict what an API key can access:

| Scope | Description |
|-------|-------------|
| `service:auth` | Access Auth service API |
| `service:sms` | Access SMS service API |
| `service:nostr` | Access Nostr service API |
| `service:shares` | Access Shares service API |
| `service:solowallet` | Access Solo Wallet service API |
| `service:chama` | Access Chama service API |
| `service:notification` | Access Notification service API |
| `service:swap` | Access Swap service API |
| `user:read` | Read user data |
| `user:write` | Modify user data |
| `transaction:read` | Read transaction data |
| `transaction:write` | Create transactions |

## Production Considerations

In production:

1. Use service-specific API keys with limited scopes
2. Implement automated key rotation
3. Set up monitoring for API key usage
4. Enable strict scope checking

### Creating Service-Specific API Keys

For production deployments, you should create dedicated API keys for each service with only the necessary scopes:

```bash
# Create a new service-specific API key
bun apikey:create
```

Follow the interactive prompts to specify:
- A descriptive name (e.g., "Production Auth Service")
- Owner ID (typically "system" for service keys)
- Select only the required scopes for the service
- Set an appropriate expiration (or "permanent" for long-lived keys)
- Specify whether it's a service key and which service it belongs to

### Implementing API Key Rotation

Regularly rotating API keys is a security best practice. Use the rotation script to update service keys:

```bash
# Rotate a service API key
bun apikey:rotate
```

The rotation process:
1. Creates a new API key for the selected service
2. Revokes the old API key
3. Updates the service's environment file with the new key
4. Returns the new key for you to securely store

### Setting Up a Rotation Schedule

For production, implement a regular rotation schedule:

1. Schedule monthly rotations with a CI/CD pipeline or cron job
2. Use a transition period where both old and new keys work
3. Monitor for any failed authentications after rotation

```bash
# Example cron job to rotate keys monthly
0 0 1 * * cd /path/to/bitsacco && bun apikey:rotate
```

## Troubleshooting

### Common Issues

1. **"API key required" error**
   - Make sure you're including the API key in the `x-api-key` header
   - Check if the endpoint requires an API key

2. **"Insufficient API key permissions" error**
   - Your API key doesn't have the required scopes
   - In development, this is logged as a warning but allowed
   - In production, this is a hard error
   - Verify your key has all required scopes by running:
     ```bash
     # Check the database for your key's scopes
     mongosh bitsacco --eval "db.apikeys.findOne({keyHash: /.*/, metadata: {isGlobalDevKey: true}})"
     ```

3. **"Invalid API key" error**
   - The API key doesn't exist in the database
   - The API key has been revoked
   - The API key has expired
   - The API key format is invalid (must start with 'bsk_')
   - The hash salt might be different from what was used when creating the key

4. **Service-to-service communication failures**
   - Check that the API key is correctly added to request headers
   - Verify the service has the proper service scope (e.g., 'service:auth')

5. **CombinedAuthGuard issues**
   - Ensure both JWT and API key authentication are properly configured
   - Check that both dependencies are injected into the guard
   - Run `bun apikey:test:combined` to test both auth methods

### Debugging

Set `LOG_LEVEL=debug` in your .env file to see detailed API key logs:

```
LOG_LEVEL=debug
```

To check the global API key in a service's environment:

```bash
# Verify the key exists in environment files
grep GLOBAL_API_KEY apps/*/dev.env
```

To monitor API key usage in real-time:

```bash
# Watch the logs for API key related events
bun dev | grep -i "api.key"
```

## Security Notes

- Never commit API keys to the repository
- In production, rotate keys regularly
- Use the minimum required scopes for each service
- Monitor for unusual API key usage patterns

### API Documentation Access

By default, the Swagger documentation (`/docs`) is:
- **Enabled** in development and test environments
- **Disabled** in production for security reasons

To enable documentation in production, set the environment variable:
```
ENABLE_SWAGGER_DOCS=true
```

This helps protect your API by hiding detailed endpoint information in production environments. When disabled, any request to `/docs` will return a 404 Not Found response.