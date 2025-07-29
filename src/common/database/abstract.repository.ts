import {
  FilterQuery,
  Model,
  PipelineStage,
  SortOrder,
  UpdateQuery,
} from 'mongoose';
import { Logger, NotFoundException } from '@nestjs/common';
import { AbstractDocument } from './abstract.schema';

export abstract class AbstractRepository<TDocument extends AbstractDocument> {
  protected abstract readonly logger: Logger;

  constructor(protected readonly model: Model<TDocument>) {}

  async create(
    document: Omit<TDocument, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TDocument> {
    const createdDocument = new this.model(document);
    return (await createdDocument.save()).toJSON() as unknown as TDocument;
  }

  async findOne(filterQuery: FilterQuery<TDocument>): Promise<TDocument> {
    const document = await this.model
      .findOne(filterQuery)
      .lean<TDocument>(true);

    if (!document) {
      this.logger.warn(
        `Document was not found with filterQuery:  ${JSON.stringify(filterQuery)}`,
      );
      throw new NotFoundException('Document was not found');
    }

    return document;
  }

  async findOneAndUpdate(
    filterQuery: FilterQuery<TDocument>,
    update: UpdateQuery<TDocument>,
  ): Promise<TDocument> {
    const document = await this.model
      .findOneAndUpdate(
        filterQuery,
        {
          ...update,
          updatedAt: Date.now(),
        },
        {
          new: true,
        },
      )
      .lean<TDocument>(true);

    if (!document) {
      this.logger.warn(
        `Document was not found with filterQuery:  ${JSON.stringify(filterQuery)}`,
      );
      throw new NotFoundException('Document was not found');
    }

    return document;
  }

  async find(
    filterQuery: FilterQuery<TDocument>,
    sort?: { [key: string]: SortOrder },
  ): Promise<TDocument[]> {
    const query = this.model.find(filterQuery).lean<TDocument[]>(true);

    if (sort) {
      query.sort(sort);
    }

    return query.exec();
  }

  async findOneAndDelete(
    filterQuery: FilterQuery<TDocument>,
  ): Promise<TDocument> {
    return this.model.findOneAndDelete(filterQuery).lean<TDocument>(true);
  }

  async aggregate(pipeline: PipelineStage[]): Promise<any[]> {
    return this.model.aggregate(pipeline);
  }
}
