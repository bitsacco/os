import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../infrastructure/database/base.repository';
import { UsersDocument } from '../../../shared/database/users.schema';

@Injectable()
export class UserRepository extends BaseRepository<UsersDocument> {
  constructor(
    @InjectModel(UsersDocument.name) userModel: Model<UsersDocument>,
  ) {
    super(userModel);
  }

  async findByPhone(phone: string): Promise<UsersDocument | null> {
    return this.findOne({ phone });
  }

  async findByEmail(email: string): Promise<UsersDocument | null> {
    return this.findOne({ email });
  }

  async findByNpub(npub: string): Promise<UsersDocument | null> {
    return this.findOne({ npub });
  }

  async findActiveUsers(page: number = 1, limit: number = 10) {
    return this.findWithPagination({ status: 'active' }, page, limit);
  }

  async updateLastLogin(userId: string): Promise<UsersDocument | null> {
    return this.findOneAndUpdate({ _id: userId }, { lastLoginAt: new Date() });
  }
}
