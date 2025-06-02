import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../infrastructure/database/base.repository';
import { ApiKeyDocument } from '@bitsacco/common/database/apikey.schema';

@Injectable()
export class ApiKeyRepository extends BaseRepository<ApiKeyDocument> {
  constructor(@InjectModel('ApiKey') apiKeyModel: Model<ApiKeyDocument>) {
    super(apiKeyModel);
  }

  async findByKeyId(keyId: string): Promise<ApiKeyDocument | null> {
    return this.findOne({ keyId, isActive: true });
  }

  async findByService(service: string): Promise<ApiKeyDocument[]> {
    return this.find({ service, isActive: true });
  }

  async deactivateKey(keyId: string): Promise<ApiKeyDocument | null> {
    return this.findOneAndUpdate(
      { keyId },
      { isActive: false, updatedAt: new Date() },
    );
  }

  async findActiveKeys(): Promise<ApiKeyDocument[]> {
    return this.find({ isActive: true });
  }
}
