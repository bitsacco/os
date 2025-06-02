import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseDomainService } from '../../../shared/domain/base-domain.service';
import { BusinessMetricsService } from '../../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../infrastructure/monitoring/telemetry.service';
import { ApiKeyRepository } from '../repositories/apikey.repository';

@Injectable()
export class ApiKeyService extends BaseDomainService {
  constructor(
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metricsService: BusinessMetricsService,
    protected readonly telemetryService: TelemetryService,
    private readonly apiKeyRepository: ApiKeyRepository,
  ) {
    super(eventEmitter, metricsService, telemetryService);
  }

  async findByKeyId(keyId: string): Promise<any> {
    return this.executeWithErrorHandling('findByKeyId', async () => {
      return this.apiKeyRepository.findOne({ _id: keyId });
    });
  }

  async validateApiKey(keyId: string, hashedKey: string): Promise<boolean> {
    return this.executeWithErrorHandling('validateApiKey', async () => {
      const apiKey = await this.apiKeyRepository.findOne({ _id: keyId });
      return apiKey && apiKey.keyHash === hashedKey && !apiKey.revoked;
    });
  }

  async createApiKey(service: string, hashedKey: string): Promise<any> {
    return this.executeWithErrorHandling('createApiKey', async () => {
      const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return this.apiKeyRepository.create({
        keyHash: hashedKey,
        name: service,
        ownerId: 'system',
        scopes: [],
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        revoked: false,
        isPermanent: true,
        metadata: { service },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  }

  async revokeApiKey(keyId: string): Promise<any> {
    return this.executeWithErrorHandling('revokeApiKey', async () => {
      return this.apiKeyRepository.findOneAndUpdate(
        { _id: keyId },
        { revoked: true, updatedAt: new Date() },
      );
    });
  }

  async revokeKey(keyId: string): Promise<any> {
    return this.executeWithErrorHandling('revokeKey', async () => {
      return this.apiKeyRepository.findOneAndUpdate(
        { _id: keyId },
        { revoked: true, updatedAt: new Date() },
      );
    });
  }

  async rotateKey(keyId: string): Promise<any> {
    return this.executeWithErrorHandling('rotateKey', async () => {
      // Implementation depends on your rotation strategy
      // For now, just revoke the old key
      return this.apiKeyRepository.findOneAndUpdate(
        { _id: keyId },
        { revoked: true, updatedAt: new Date() },
      );
    });
  }

  async getKeyUsage(keyId: string): Promise<any> {
    return this.executeWithErrorHandling('getKeyUsage', async () => {
      const apiKey = await this.apiKeyRepository.findOne({ _id: keyId });
      return {
        keyId,
        usageCount: apiKey?.metadata?.usageCount || 0,
        lastUsed: apiKey?.metadata?.lastUsed || null,
      };
    });
  }

  async updateKeyScopes(keyId: string, scopes: string[]): Promise<any> {
    return this.executeWithErrorHandling('updateKeyScopes', async () => {
      return this.apiKeyRepository.findOneAndUpdate(
        { _id: keyId },
        { scopes, updatedAt: new Date() },
      );
    });
  }

  // Legacy compatibility methods for the microservice interface
  async createApiKeyLegacy(service: string, hashedKey: string): Promise<any> {
    return this.createApiKey(service, hashedKey);
  }

  async validateApiKeyLegacy(
    keyId: string,
    hashedKey: string,
  ): Promise<boolean> {
    return this.validateApiKey(keyId, hashedKey);
  }

  async revokeApiKeyLegacy(keyId: string): Promise<any> {
    return this.revokeApiKey(keyId);
  }
}
