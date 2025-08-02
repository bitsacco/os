import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '../../common/database';
import { LightningAddressDocument } from '.';

@Injectable()
export class LightningAddressRepository extends AbstractRepository<LightningAddressDocument> {
  protected readonly logger = new Logger(LightningAddressRepository.name);

  constructor(
    @InjectModel(LightningAddressDocument.name)
    lightningAddressModel: Model<LightningAddressDocument>,
  ) {
    super(lightningAddressModel);
  }
}
