import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CachedSecret {
  value: string;
  expiresAt: number;
}

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);
  private readonly secretCache = new Map<string, CachedSecret>();

  constructor(private readonly configService: ConfigService) {}

  async getSecret(key: string): Promise<string> {
    // Check cache first
    const cached = this.secretCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // In development, use the global API key for all service keys
    const isDev = this.configService.get('NODE_ENV') === 'development';
    if (isDev && key.endsWith('_API_KEY')) {
      const globalKey = this.configService.get<string>('GLOBAL_API_KEY');
      if (globalKey) {
        this.logger.debug(`Using global dev API key for ${key}`);
        this.cacheSecret(key, globalKey);
        return globalKey;
      }
    }

    // Try to get from environment variables first
    const envValue = this.configService.get<string>(key);
    if (envValue) {
      // Cache with 60-minute expiration
      this.cacheSecret(key, envValue);
      return envValue;
    }

    // If we're in production, we'd get from a secure vault here
    this.logger.warn(`Secret ${key} not found in environment or vault`);
    return '';
  }

  async setSecret(key: string, value: string): Promise<void> {
    // In production, store in external secrets manager
    // For now, just cache it
    this.cacheSecret(key, value);
    this.logger.log(`Secret ${key} updated (cached only)`);

    // Note: This doesn't actually update environment variables
    // In a real implementation, you'd use a secrets manager
    // or a coordinated approach to distribute to all services
  }

  private cacheSecret(key: string, value: string): void {
    this.secretCache.set(key, {
      value,
      expiresAt: Date.now() + 60 * 60 * 1000, // 60 minute cache
    });
  }
}
