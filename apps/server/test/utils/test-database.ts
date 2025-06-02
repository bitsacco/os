import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { mock } from 'bun:test';

export class TestDatabase {
  static forRoot() {
    return MongooseModule.forRoot(process.env.MONGODB_URI!, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false,
      bufferMaxEntries: 0,
    });
  }

  static async clearDatabase(connection: mongoose.Connection) {
    if (!connection || !connection.db) {
      console.warn('Database connection not available for clearing');
      return;
    }

    try {
      const collections = await connection.db.collections();

      for (const collection of collections) {
        await collection.deleteMany({});
      }
    } catch (error) {
      console.warn('Failed to clear database:', error.message);
    }
  }

  static async seedDatabase(connection: mongoose.Connection, seedData: any) {
    for (const [collectionName, documents] of Object.entries(seedData)) {
      if (Array.isArray(documents) && documents.length > 0) {
        await connection.db.collection(collectionName).insertMany(documents);
      }
    }
  }

  static createMockConnection(): Partial<mongoose.Connection> {
    return {
      readyState: 1,
      db: {
        startSession: mock(() => ({
          startTransaction: mock(() => {}),
          commitTransaction: mock(() => {}),
          abortTransaction: mock(() => {}),
          endSession: mock(() => {}),
          withTransaction: mock((fn) => fn()),
        })),
        collection: mock(() => ({
          insertOne: mock(() => {}),
          insertMany: mock(() => {}),
          findOne: mock(() => {}),
          find: mock(() => ({
            toArray: mock(() => []),
            limit: mock(() => this),
            skip: mock(() => this),
            sort: mock(() => this),
          })),
          updateOne: mock(() => {}),
          updateMany: mock(() => {}),
          deleteOne: mock(() => {}),
          deleteMany: mock(() => {}),
          countDocuments: mock(() => 0),
        })),
      } as any,
      startSession: mock(() => ({
        startTransaction: mock(() => {}),
        commitTransaction: mock(() => {}),
        abortTransaction: mock(() => {}),
        endSession: mock(() => {}),
        withTransaction: mock((fn) => fn()),
      })),
      on: mock(() => {}),
      once: mock(() => {}),
    };
  }
}
