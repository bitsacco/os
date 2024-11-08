import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '@bitsacco/common';
import { MpesaOnrampSwapDocument } from './onramp.schema';

@Injectable()
export class MpesaOnrampSwapRepository extends AbstractRepository<MpesaOnrampSwapDocument> {
  protected readonly logger = new Logger(MpesaOnrampSwapRepository.name);

  constructor(
    @InjectModel(MpesaOnrampSwapDocument.name)
    reservationModel: Model<MpesaOnrampSwapDocument>,
  ) {
    super(reservationModel);
  }
}
