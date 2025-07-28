import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ApiKeyRepository } from '../database/apikey.repository';
import { ApiKeyDocument, ApiKeyScope } from '../database/apikey.schema';

export interface CreateApiKeyOptions {
  name: string;
  userId: string;
  scopes: ApiKeyScope[];
  expiresInDays?: number;
}

export interface ApiKeyPair {
  id: string;
  key: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresAt: Date;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly defaultExpirationDays = 90;

  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly configService: ConfigService,
  ) {}

  async createApiKey(options: CreateApiKeyOptions): Promise<ApiKeyPair> {
    const key = crypto.randomBytes(32).toString('base64url');
    const fullKey = `bsk_${key}`;
    const keyHash = this.hashApiKey(fullKey);

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() +
        (options.expiresInDays || this.defaultExpirationDays),
    );

    const apiKey = await this.apiKeyRepository.create({
      keyHash,
      name: options.name,
      userId: options.userId,
      scopes: options.scopes,
      expiresAt,
      revoked: false,
    });

    this.logger.log(
      `API key created: ${apiKey._id} for user ${options.userId}`,
    );

    return {
      id: apiKey._id,
      key: fullKey,
      name: apiKey.name,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
    };
  }

  async validateApiKey(apiKey: string): Promise<ApiKeyDocument> {
    if (!apiKey || !apiKey.startsWith('bsk_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    try {
      const keyHash = this.hashApiKey(apiKey);
      const apiKeyDoc = await this.apiKeyRepository.findByHash(keyHash);

      if (!apiKeyDoc) {
        throw new UnauthorizedException('Invalid API key');
      }

      if (apiKeyDoc.revoked) {
        throw new UnauthorizedException('API key has been revoked');
      }

      if (apiKeyDoc.expiresAt < new Date()) {
        this.logger.warn(`Expired API key used: ${apiKeyDoc._id}`);
        throw new UnauthorizedException('API key expired');
      }

      // Update last used timestamp asynchronously
      this.apiKeyRepository.updateLastUsed(apiKeyDoc._id).catch((error) => {
        this.logger.error(
          `Failed to update API key last used: ${error.message}`,
        );
      });

      return apiKeyDoc;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`API key validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid API key');
    }
  }

  async revokeKey(userId: string, keyId: string): Promise<boolean> {
    try {
      const apiKey = await this.apiKeyRepository.findOne({
        _id: keyId,
        userId,
      });

      if (!apiKey) {
        throw new UnauthorizedException('API key not found or unauthorized');
      }

      await this.apiKeyRepository.revokeKey(keyId);
      this.logger.log(`API key ${keyId} revoked by user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to revoke API key ${keyId}: ${error.message}`);
      throw error;
    }
  }

  async getApiKey(userId: string, keyId: string): Promise<ApiKeyDocument> {
    const apiKey = await this.apiKeyRepository.findOne({ _id: keyId, userId });

    if (!apiKey) {
      throw new UnauthorizedException('API key not found or unauthorized');
    }

    return apiKey;
  }

  async listUserKeys(userId: string): Promise<ApiKeyDocument[]> {
    return this.apiKeyRepository.find({
      userId,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });
  }

  async checkKeyPermission(
    apiKey: ApiKeyDocument,
    requiredScope: ApiKeyScope,
  ): Promise<boolean> {
    if (apiKey.scopes.includes(ApiKeyScope.AdminAccess)) {
      return true;
    }

    if (apiKey.scopes.includes(requiredScope)) {
      return true;
    }

    // Check for general read/write permissions
    if (
      requiredScope.endsWith(':read') &&
      apiKey.scopes.includes(ApiKeyScope.Read)
    ) {
      return true;
    }

    if (
      requiredScope.endsWith(':write') &&
      apiKey.scopes.includes(ApiKeyScope.Write)
    ) {
      return true;
    }

    return false;
  }

  private hashApiKey(key: string): string {
    const salt = this.configService.get('API_KEY_SALT', 'bitsacco-api-salt');
    return crypto.createHmac('sha256', salt).update(key).digest('hex');
  }
}
