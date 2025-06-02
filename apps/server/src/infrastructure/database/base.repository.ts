import {
  FilterQuery,
  Model,
  Types,
  UpdateQuery,
  QueryOptions,
  ClientSession,
} from 'mongoose';
import { Logger } from '@nestjs/common';
import { AbstractDocument } from '@bitsacco/common/database';

export abstract class BaseRepository<TDocument extends AbstractDocument> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly model: Model<TDocument>) {}

  async create(
    document: Omit<TDocument, '_id'>,
    options?: { session?: ClientSession },
  ): Promise<TDocument> {
    const createdDocument = new this.model({
      ...document,
      _id: new Types.ObjectId(),
    });

    const saved = await createdDocument.save({ session: options?.session });
    return saved.toJSON() as unknown as TDocument;
  }

  async findOne(
    filterQuery: FilterQuery<TDocument>,
    options?: QueryOptions<TDocument>,
  ): Promise<TDocument | null> {
    return this.model.findOne(filterQuery, {}, options).lean<TDocument>(true);
  }

  async findOneAndUpdate(
    filterQuery: FilterQuery<TDocument>,
    update: UpdateQuery<TDocument>,
    options?: QueryOptions<TDocument> & { session?: ClientSession },
  ): Promise<TDocument | null> {
    return this.model.findOneAndUpdate(filterQuery, update, {
      lean: true,
      new: true,
      ...options,
    });
  }

  async find(
    filterQuery: FilterQuery<TDocument>,
    options?: QueryOptions<TDocument>,
  ): Promise<TDocument[]> {
    return this.model.find(filterQuery, {}, options).lean<TDocument[]>(true);
  }

  async findWithPagination(
    filterQuery: FilterQuery<TDocument>,
    page: number = 1,
    limit: number = 10,
    options?: QueryOptions<TDocument>,
  ): Promise<{
    documents: TDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      this.model
        .find(filterQuery, {}, options)
        .skip(skip)
        .limit(limit)
        .lean<TDocument[]>(true),
      this.model.countDocuments(filterQuery),
    ]);

    return {
      documents,
      total,
      page,
      limit,
    };
  }

  async findOneAndDelete(
    filterQuery: FilterQuery<TDocument>,
    options?: QueryOptions<TDocument> & { session?: ClientSession },
  ): Promise<TDocument | null> {
    return this.model.findOneAndDelete(filterQuery, {
      lean: true,
      ...options,
    });
  }

  async deleteMany(
    filterQuery: FilterQuery<TDocument>,
    options?: { session?: ClientSession },
  ): Promise<number> {
    const result = await this.model.deleteMany(filterQuery, {
      session: options?.session,
    });
    return result.deletedCount || 0;
  }

  async updateMany(
    filterQuery: FilterQuery<TDocument>,
    update: UpdateQuery<TDocument>,
    options?: { session?: ClientSession },
  ): Promise<number> {
    const result = await this.model.updateMany(filterQuery, update, {
      session: options?.session,
    });
    return result.modifiedCount || 0;
  }

  async exists(filterQuery: FilterQuery<TDocument>): Promise<boolean> {
    const document = await this.model.findOne(filterQuery).select('_id').lean();
    return !!document;
  }

  async startSession(): Promise<ClientSession> {
    return this.model.db.startSession();
  }

  async executeInTransaction<T>(
    operation: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.startSession();

    try {
      return await session.withTransaction(async () => {
        return await operation(session);
      });
    } finally {
      await session.endSession();
    }
  }
}
