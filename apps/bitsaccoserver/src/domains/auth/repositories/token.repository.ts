import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../infrastructure/database/base.repository';
import { TokenDocument } from '@bitsacco/common/database/token.schema';

@Injectable()
export class TokenRepository extends BaseRepository<TokenDocument> {
  constructor(
    @InjectModel(TokenDocument.name) tokenModel: Model<TokenDocument>,
  ) {
    super(tokenModel);
  }

  async findByUserId(userId: string): Promise<TokenDocument[]> {
    return this.find({ userId });
  }

  async findActiveTokens(userId: string): Promise<TokenDocument[]> {
    const now = new Date();
    return this.find({
      userId,
      expiresAt: { $gt: now },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    return this.deleteMany({ userId });
  }

  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    return this.deleteMany({
      expiresAt: { $lt: now },
    });
  }
}
