import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '@bitsacco/common';
import { SharesDocument } from './shares.schema';

@Injectable()
export class SharesRepository extends AbstractRepository<SharesDocument> {
  protected readonly logger = new Logger(SharesRepository.name);

  constructor(
    @InjectModel(SharesDocument.name)
    reservationModel: Model<SharesDocument>,
  ) {
    super(reservationModel);
  }
}
