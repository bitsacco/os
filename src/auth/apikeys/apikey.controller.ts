import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyService, JwtAuthGuard } from '../../common';
import { ApiKeyResponseDto, CreateApiKeyDto } from './apikey.dto';

@Controller({
  path: 'api-keys',
})
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async createApiKey(
    @Body() createApiKeyDto: CreateApiKeyDto,
    @Req() req,
  ): Promise<ApiKeyResponseDto> {
    const apiKey = await this.apiKeyService.createApiKey({
      name: createApiKeyDto.name,
      userId: req.user.id,
      scopes: createApiKeyDto.scopes,
      expiresInDays: createApiKeyDto.expiresInDays,
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
  async listApiKeys(@Req() req): Promise<Omit<ApiKeyResponseDto, 'key'>[]> {
    const keys = await this.apiKeyService.listUserKeys(req.user.id);

    return keys.map((key) => ({
      id: key._id,
      name: key.name,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
    }));
  }

  @Get(':id')
  async getApiKey(
    @Param('id') id: string,
    @Req() req,
  ): Promise<Omit<ApiKeyResponseDto, 'key'>> {
    const key = await this.apiKeyService.getApiKey(req.user.id, id);

    return {
      id: key._id,
      name: key.name,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
    };
  }

  @Delete(':id')
  async revokeApiKey(
    @Param('id') id: string,
    @Req() req,
  ): Promise<{ success: boolean }> {
    const success = await this.apiKeyService.revokeKey(req.user.id, id);
    return { success };
  }
}
