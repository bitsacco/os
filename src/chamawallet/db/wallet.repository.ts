import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '../../common';
import { ChamaWalletDocument } from './wallet.schema';

@Injectable()
export class ChamaWalletRepository extends AbstractRepository<ChamaWalletDocument> {
  protected readonly logger = new Logger(ChamaWalletRepository.name);

  constructor(
    @InjectModel(ChamaWalletDocument.name)
    public readonly model: Model<ChamaWalletDocument>,
  ) {
    super(model);
  }
}
