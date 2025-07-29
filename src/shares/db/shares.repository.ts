import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '../../common';
import { SharesDocument, SharesOfferDocument } from './shares.schema';

@Injectable()
export class SharesOfferRepository extends AbstractRepository<SharesOfferDocument> {
  protected readonly logger = new Logger(SharesOfferRepository.name);

  constructor(
    @InjectModel(SharesOfferDocument.name)
    reservationModel: Model<SharesOfferDocument>,
  ) {
    super(reservationModel);
  }
}

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
