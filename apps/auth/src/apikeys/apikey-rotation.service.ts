import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiKeyRepository, ApiKeyService } from '@bitsacco/common';

@Injectable()
export class ApiKeyRotationService {
  private readonly logger = new Logger(ApiKeyRotationService.name);

  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  // Run weekly to check for keys near expiration
  @Cron(CronExpression.EVERY_WEEK)
  async checkExpiringKeys() {
    this.logger.log('Checking for expiring API keys');
    
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + 7); // 7 days warning
    
    const expiringKeys = await this.apiKeyRepository.find({
      expiresAt: { $lt: thresholdDate, $gt: new Date() },
      revoked: false,
    });
    
    for (const key of expiringKeys) {
      this.logger.log(`Key ${key._id} for ${key.ownerId} expires soon`);
      
      // In production, this would send notifications
      // to key owners about impending expiration
    }
  }

  // Run daily to rotate system keys that are older than 90 days
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async rotateSystemKeys() {
    this.logger.log('Checking system keys for rotation');
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const systemKeys = await this.apiKeyRepository.find({
      ownerId: 'system',
      createdAt: { $lt: ninetyDaysAgo },
      revoked: false,
      'metadata.isSystemKey': true,
    });
    
    for (const key of systemKeys) {
      this.logger.log(`Rotating system key ${key._id} for ${key.metadata.service}`);
      
      try {
        // Create new key with same scopes
        const newKey = await this.apiKeyService.createApiKey({
          name: key.name,
          ownerId: 'system',
          scopes: key.scopes,
          expiresInDays: 365,
          isPermanent: true,
          metadata: {
            ...key.metadata,
            previousKeyId: key._id,
          },
        });
        
        // In production, this would trigger updates to environment
        // variables or secrets manager with the new key
        this.logger.log(
          `Created new key ${newKey.id} to replace ${key._id}. Update ${key.metadata.service} configuration.`,
        );
        
        // Give systems time to update before revoking old key
        // In production, you'd implement a grace period with verification
        setTimeout(async () => {
          await this.apiKeyRepository.revokeKey(key._id);
          this.logger.log(`Revoked old system key ${key._id}`);
        }, 7 * 24 * 60 * 60 * 1000); // 7 days grace period
      } catch (error) {
        this.logger.error(
          `Failed to rotate system key ${key._id}: ${error.message}`,
        );
      }
    }
  }
}