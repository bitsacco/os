import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '@bitsacco/common';
import { ChamasDocument } from './chamas.schema';

@Injectable()
export class ChamasRepository extends AbstractRepository<ChamasDocument> {
  protected readonly logger = new Logger(ChamasRepository.name);

  constructor(
    @InjectModel(ChamasDocument.name)
    chamaModel: Model<ChamasDocument>,
  ) {
    super(chamaModel);
  }
}
