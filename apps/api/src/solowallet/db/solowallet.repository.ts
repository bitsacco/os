import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '@bitsacco/common';
import { SolowalletDocument } from './solowallet.schema';

@Injectable()
export class SolowalletRepository extends AbstractRepository<SolowalletDocument> {
  protected readonly logger = new Logger(SolowalletRepository.name);

  constructor(
    @InjectModel(SolowalletDocument.name)
    reservationModel: Model<SolowalletDocument>,
  ) {
    super(reservationModel);
  }
}
