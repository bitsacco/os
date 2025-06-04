import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from '../services/apikey.service';

@Injectable()
export class ApiKeyStrategy {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async validate(req: any): Promise<any> {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Extract key ID and hash (assuming format: keyId.hash)
    const [keyId, keyHash] = apiKey.split('.');

    if (!keyId || !keyHash) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const isValid = await this.apiKeyService.validateApiKey(keyId, keyHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    const apiKeyDoc = await this.apiKeyService.findByKeyId(keyId);

    return {
      apiKeyId: keyId,
      service: apiKeyDoc?.service,
      type: 'apikey',
    };
  }
}
