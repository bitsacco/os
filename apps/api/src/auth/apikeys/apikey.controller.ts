import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiKeyService,
  JwtAuthGuard,
  Role,
  CurrentUser,
} from '@bitsacco/common';
import { ApiKeyResponseDto, CreateApiKeyDto } from './apikey.dto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async createApiKey(
    @Body() createApiKeyDto: CreateApiKeyDto,
    @CurrentUser() user: any,
  ): Promise<ApiKeyResponseDto> {
    // Regular users can only create API keys for themselves
    if (
      createApiKeyDto.ownerId !== user.id &&
      !user.roles.includes(Role.Admin)
    ) {
      throw new UnauthorizedException('Cannot create API keys for other users');
    }

    // Non-admin users cannot create admin-scoped API keys
    if (
      !user.roles.includes(Role.Admin) &&
      createApiKeyDto.scopes.some((scope) => scope.startsWith('admin:'))
    ) {
      throw new UnauthorizedException('Cannot create admin-scoped API keys');
    }

    const apiKey = await this.apiKeyService.createApiKey({
      name: createApiKeyDto.name,
      ownerId: createApiKeyDto.ownerId || user.id,
      scopes: createApiKeyDto.scopes,
      expiresInDays: createApiKeyDto.expiresInDays || 30,
      metadata: {
        createdBy: user.id,
        userAgent: createApiKeyDto.userAgent,
        description: createApiKeyDto.description,
      },
    });

    return {
      id: apiKey.id,
      key: apiKey.key, // Only returned at creation time
      name: apiKey.name,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
    };
  }

  @Get()
  async listApiKeys(
    @CurrentUser() user: any,
  ): Promise<Omit<ApiKeyResponseDto, 'key'>[]> {
    const keys = await this.apiKeyService.listUserKeys(user.id);

    return keys.map((key) => ({
      id: key._id,
      name: key.name,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
    }));
  }

  @Delete(':id')
  async revokeApiKey(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean }> {
    const key = await this.apiKeyService.getApiKey(id);

    // Check if user owns the key or is an admin
    if (key.ownerId !== user.id && !user.roles.includes(Role.Admin)) {
      throw new UnauthorizedException("Cannot revoke other users' API keys");
    }

    const success = await this.apiKeyService.revokeKey(id);

    return { success };
  }
}
