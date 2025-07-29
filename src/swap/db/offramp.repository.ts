import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '../../common';
import { MpesaOfframpSwapDocument } from './offramp.schema';

@Injectable()
export class MpesaOfframpSwapRepository extends AbstractRepository<MpesaOfframpSwapDocument> {
  protected readonly logger = new Logger(MpesaOfframpSwapRepository.name);

  constructor(
    @InjectModel(MpesaOfframpSwapDocument.name)
    reservationModel: Model<MpesaOfframpSwapDocument>,
  ) {
    super(reservationModel);
  }
}
