import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepository } from './abstract.repository';
import { TokenDocument } from './token.schema';

@Injectable()
export class TokenRepository extends AbstractRepository<TokenDocument> {
  protected readonly logger = new Logger(TokenRepository.name);

  constructor(
    @InjectModel(TokenDocument.name)
    private tokenModel: Model<TokenDocument>,
  ) {
    super(tokenModel);
  }

  async findByTokenId(tokenId: string): Promise<TokenDocument> {
    return this.findOne({ tokenId });
  }

  async findByFamily(tokenFamily: string): Promise<TokenDocument[]> {
    return this.find({ tokenFamily });
  }

  async getTokenFamily(tokenId: string): Promise<string | null> {
    const token = await this.findOne({ tokenId });
    return token?.tokenFamily || null;
  }

  async revokeToken(tokenId: string): Promise<boolean> {
    const result = await this.findOneAndUpdate({ tokenId }, { revoked: true });
    return !!result;
  }

  async revokeFamily(tokenFamily: string): Promise<boolean> {
    const result = await this.model.updateMany(
      { tokenFamily, revoked: false },
      { revoked: true },
    );
    return result.modifiedCount > 0;
  }

  async revokeAllUserTokens(userId: string): Promise<boolean> {
    const result = await this.model.updateMany(
      { userId, revoked: false },
      { revoked: true },
    );
    return result.modifiedCount > 0;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.model.deleteMany({
      expires: { $lt: new Date() },
    });
    return result.deletedCount;
  }
}
