import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ApiKeyRepository } from '../database/apikey.repository';
import { ApiKeyDocument, ApiKeyScope } from '../database/apikey.schema';

export interface CreateApiKeyOptions {
  name: string;
  ownerId: string;
  scopes: ApiKeyScope[];
  expiresInDays: number;
  isPermanent?: boolean;
  metadata?: Record<string, any>;
}

export interface ApiKeyPair {
  id: string;
  key: string; // Plain text key (only returned at creation time)
  name: string;
  scopes: ApiKeyScope[];
  expiresAt: Date;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly configService: ConfigService,
  ) {}

  async createApiKey(options: CreateApiKeyOptions): Promise<ApiKeyPair> {
    // Generate a secure random API key (32 bytes base64 = ~43 chars)
    const keyBuffer = crypto.randomBytes(32);
    const key = keyBuffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Prefix with 'bsk_' to identify as Bitsacco key
    const fullKey = `bsk_${key}`;

    // Hash the key for storage - we use SHA-256 as this isn't a password
    const keyHash = this.hashApiKey(fullKey);

    // Calculate expiration date
    const expiresAt = new Date();
    if (options.isPermanent) {
      // Far future date for "permanent" keys (10 years)
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    } else {
      expiresAt.setDate(expiresAt.getDate() + options.expiresInDays);
    }

    // Create the API key record
    const apiKey = await this.apiKeyRepository.create({
      keyHash,
      name: options.name,
      ownerId: options.ownerId,
      scopes: options.scopes,
      expiresAt,
      revoked: false,
      isPermanent: options.isPermanent || false,
      metadata: options.metadata || {},
    });

    // Log key creation but not the actual key
    this.logger.log(
      `API key created: ${apiKey._id} for owner ${options.ownerId}`,
    );

    // Return the API key pair (only time the plain text key is available)
    return {
      id: apiKey._id,
      key: fullKey, // Plain text key - only returned at creation time
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
      // Hash the provided key
      const keyHash = this.hashApiKey(apiKey);

      // Find the key by hash
      const apiKeyDoc = await this.apiKeyRepository.findByHash(keyHash);

      // Check if key is expired
      if (apiKeyDoc.expiresAt < new Date()) {
        this.logger.warn(`Expired API key used: ${apiKeyDoc._id}`);
        throw new UnauthorizedException('API key expired');
      }

      // Update last used timestamp (don't await to not slow down the request)
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

  async revokeKey(id: string): Promise<boolean> {
    try {
      await this.apiKeyRepository.revokeKey(id);
      return true;
    } catch (error) {
      this.logger.error(`Failed to revoke API key ${id}: ${error.message}`);
      return false;
    }
  }

  async getApiKey(id: string): Promise<ApiKeyDocument> {
    return this.apiKeyRepository.getApiKey(id);
  }

  async listUserKeys(ownerId: string): Promise<ApiKeyDocument[]> {
    return this.apiKeyRepository.listUserKeys(ownerId);
  }

  private hashApiKey(key: string): string {
    const salt = this.configService.get('API_KEY_SALT', 'bitsacco-api-salt');
    return crypto.createHmac('sha256', salt).update(key).digest('hex');
  }
}
