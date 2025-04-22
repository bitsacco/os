# Resource Ownership Validation

This document outlines how to use the standardized resource ownership validation in Bitsacco OS.

## Purpose

The Resource Owner Guard ensures that users can only access resources they own, preventing cross-account access vulnerabilities.

## Implementation

The ownership validation consists of:

1. A decorator to define ownership requirements
2. A guard that enforces ownership validation

## How to Use

### 1. Import Required Components

```typescript
import { 
  Controller, 
  Get, 
  Param, 
  UseGuards 
} from '@nestjs/common';
import { 
  JwtAuthGuard, 
  ResourceOwnerGuard, 
  CheckOwnership 
} from '@bitsacco/common';
```

### 2. Apply Guards and Decorator to Routes

```typescript
@Controller('resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard, ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'id' })
  async getResource(@Param('id') id: string) {
    // This will only succeed if the authenticated user owns the resource
    return this.resourceService.findOne(id);
  }
}
```

### 3. Custom ID Field Mapping

By default, the guard compares the route parameter with the user's `_id` field. If your user object has a different ID field, specify it in the decorator:

```typescript
@Get(':id')
@UseGuards(JwtAuthGuard, ResourceOwnerGuard)
@CheckOwnership({ paramName: 'id', idField: 'userId' })
async getResource(@Param('id') id: string) {
  // This will check if id === user.userId
  return this.resourceService.findOne(id);
}
```

## How It Works

1. The `CheckOwnership` decorator attaches metadata to routes
2. The `ResourceOwnerGuard` reads this metadata to determine:
   - Which route parameter contains the resource ID
   - Which user field to compare it against
3. Admin users automatically bypass ownership checks
4. For non-admin users, the guard compares the resource ID to the user's ID

## Security Considerations

- Always apply both authentication and ownership guards
- Consider using CombinedAuthGuard along with ResourceOwnerGuard
- Remember that Admin roles bypass ownership checks by design