import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepository } from './abstract.repository';
import { ApiKeyDocument } from './apikey.schema';

@Injectable()
export class ApiKeyRepository extends AbstractRepository<ApiKeyDocument> {
  protected readonly logger = new Logger(ApiKeyRepository.name);

  constructor(
    @InjectModel(ApiKeyDocument.name) apiKeyModel: Model<ApiKeyDocument>,
  ) {
    super(apiKeyModel);
  }

  async findByHash(keyHash: string): Promise<ApiKeyDocument> {
    return this.findOne({ keyHash, revoked: false });
  }

  async revokeKey(id: string): Promise<ApiKeyDocument> {
    return this.findOneAndUpdate({ _id: id }, { revoked: true });
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { lastUsed: new Date() });
  }

  async listUserKeys(ownerId: string): Promise<ApiKeyDocument[]> {
    return this.find({ ownerId });
  }

  async getApiKey(id: string): Promise<ApiKeyDocument> {
    return this.findOne({ _id: id });
  }

  async findActiveKeys(): Promise<ApiKeyDocument[]> {
    return this.find({
      revoked: false,
      expiresAt: { $gt: new Date() },
    });
  }
}
