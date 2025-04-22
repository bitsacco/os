import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyService } from './apikey.service';
import { ApiKeyScope } from '../database/apikey.schema';
import { SecretsService } from '../utils/secrets.service';

interface ServiceDefinition {
  name: string;
  scopes: ApiKeyScope[];
  envKey: string;
}

@Injectable()
export class ServiceRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ServiceRegistryService.name);
  private readonly services: ServiceDefinition[] = [
    { name: 'auth', scopes: [ApiKeyScope.ServiceAuth], envKey: 'AUTH_API_KEY' },
    { name: 'sms', scopes: [ApiKeyScope.ServiceSms], envKey: 'SMS_API_KEY' },
    {
      name: 'nostr',
      scopes: [ApiKeyScope.ServiceNostr],
      envKey: 'NOSTR_API_KEY',
    },
    {
      name: 'shares',
      scopes: [ApiKeyScope.ServiceShares],
      envKey: 'SHARES_API_KEY',
    },
    {
      name: 'solowallet',
      scopes: [ApiKeyScope.ServiceSolowallet],
      envKey: 'SOLOWALLET_API_KEY',
    },
    {
      name: 'chama',
      scopes: [ApiKeyScope.ServiceChama],
      envKey: 'CHAMA_API_KEY',
    },
    {
      name: 'notification',
      scopes: [ApiKeyScope.ServiceNotification],
      envKey: 'NOTIFICATION_API_KEY',
    },
    { name: 'swap', scopes: [ApiKeyScope.ServiceSwap], envKey: 'SWAP_API_KEY' },
  ];

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly secretsService: SecretsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureServiceKeys();
  }

  private async ensureServiceKeys() {
    for (const service of this.services) {
      // Check if we already have a key in the secrets/env
      const existingKey = this.configService.get(service.envKey);

      if (existingKey) {
        try {
          // Verify that the existing key is valid
          await this.apiKeyService.validateApiKey(existingKey);
          this.logger.log(
            `Verified existing API key for ${service.name} service`,
          );
          continue;
        } catch (error) {
          this.logger.warn(
            `Invalid API key for ${service.name} service, will create new one`,
          );
        }
      }

      try {
        // Create a new service API key
        const apiKeyPair = await this.apiKeyService.createApiKey({
          name: `Service: ${service.name}`,
          ownerId: 'system',
          scopes: service.scopes,
          expiresInDays: 365, // Long-lived keys for services
          isPermanent: true,
          metadata: {
            isServiceKey: true,
            serviceName: service.name,
          },
        });

        // Store the key in secrets service
        await this.secretsService.setSecret(service.envKey, apiKeyPair.key);

        this.logger.log(
          `Created and stored new API key for ${service.name} service`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to create API key for ${service.name}: ${error.message}`,
        );
      }
    }
  }

  async rotateServiceKey(serviceName: string): Promise<boolean> {
    const service = this.services.find((s) => s.name === serviceName);
    if (!service) {
      this.logger.error(`Unknown service: ${serviceName}`);
      return false;
    }

    try {
      // Create new key
      const apiKeyPair = await this.apiKeyService.createApiKey({
        name: `Service: ${service.name} (rotated)`,
        ownerId: 'system',
        scopes: service.scopes,
        expiresInDays: 365,
        isPermanent: true,
        metadata: {
          isServiceKey: true,
          serviceName: service.name,
          rotationDate: new Date().toISOString(),
        },
      });

      // Store new key
      await this.secretsService.setSecret(service.envKey, apiKeyPair.key);

      this.logger.log(`Rotated API key for ${service.name} service`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to rotate API key for ${service.name}: ${error.message}`,
      );
      return false;
    }
  }
}
