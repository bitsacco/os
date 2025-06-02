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

  async findByTokenId(tokenId: string): Promise<TokenDocument | null> {
    return this.findOne({ tokenId });
  }

  async findByFamily(tokenFamily: string): Promise<TokenDocument[]> {
    return this.find({ tokenFamily });
  }

  async revokeToken(tokenId: string): Promise<boolean> {
    const result = await this.findOneAndUpdate(
      { tokenId },
      { revoked: true, updatedAt: new Date() },
    );
    return !!result;
  }

  async revokeFamily(tokenFamily: string): Promise<boolean> {
    const result = await this.updateMany(
      { tokenFamily },
      { revoked: true, updatedAt: new Date() },
    );
    return result > 0;
  }

  async getTokenFamily(tokenId: string): Promise<string | null> {
    const token = await this.findOne({ tokenId });
    return token?.tokenFamily || null;
  }

  async revokeAllUserTokens(userId: string): Promise<boolean> {
    const result = await this.updateMany(
      { userId },
      { revoked: true, updatedAt: new Date() },
    );
    return result > 0;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    return this.deleteMany({
      expires: { $lt: now },
    });
  }
}
