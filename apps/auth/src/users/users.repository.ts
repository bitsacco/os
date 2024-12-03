import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository, UsersDocument } from '@bitsacco/common';

@Injectable()
export class UsersRepository extends AbstractRepository<UsersDocument> {
  protected readonly logger = new Logger(UsersRepository.name);

  constructor(
    @InjectModel(UsersDocument.name)
    userModel: Model<UsersDocument>,
  ) {
    super(userModel);
  }
}
