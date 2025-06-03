import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Create a logger
const logger = new Logger('Database');

// MongoDB connection settings
export const DB_SETTINGS = {
  // Always use localhost when running scripts directly
  MONGODB_URI: 'mongodb://bs:password@localhost:27017',
  DB_NAME: 'bitsacco',
  COLLECTIONS: {
    APIKEYS: 'apikeys',
    USERS: 'usersdocuments',
    SHARES_OFFER: 'sharesofferdocuments',
    SHARES: 'sharesdocuments',
    CHAMAS: 'chamasdocuments',
    CHAMA_WALLET: 'chamawalletdocuments',
    SOLOWALLET: 'solowalletdocuments',
  },
};

// Helper to load database connection string from env files
export function loadDatabaseUrl(): string {
  try {
    // Check service env files first
    const services = ['api', 'auth', 'shares', 'swap', 'notification'];
    for (const service of services) {
      const serviceEnvPath = path.join(
        __dirname,
        '../../apps',
        service,
        '.dev.env',
      );
      if (fs.existsSync(serviceEnvPath)) {
        const envContent = fs.readFileSync(serviceEnvPath, 'utf-8');
        let match = envContent.match(/DATABASE_URL=([^\s]+)/);
        if (match && match[1]) {
          // Replace 'mongodb' hostname with 'localhost' when not in Docker environment
          let dbUrl = match[1];
          if (dbUrl.includes('@mongodb:') && !process.env.DOCKER_ENV) {
            dbUrl = dbUrl.replace('@mongodb:', '@localhost:');
            logger.log(`Using local database connection: ${dbUrl}`);
          }
          return dbUrl;
        }
      }
    }

    // Fall back to default
    logger.log(`Using default database connection: ${DB_SETTINGS.MONGODB_URI}`);
    return DB_SETTINGS.MONGODB_URI;
  } catch (error) {
    logger.error('Error loading database URL from env files:', error);
    return DB_SETTINGS.MONGODB_URI;
  }
}

// Check if MongoDB is available
export async function isMongoDbAvailable(): Promise<boolean> {
  try {
    const dbUrl = loadDatabaseUrl();
    const client = new MongoClient(dbUrl, {
      serverSelectionTimeoutMS: 3000, // 3 second timeout
      connectTimeoutMS: 3000,
    });
    await client.connect();
    await client.close();
    return true;
  } catch (error) {
    logger.warn(`MongoDB is not available: ${error.message}`);
    return false;
  }
}

// MongoDB Client (direct) connection
export async function getMongoClient() {
  try {
    // First check if MongoDB is available
    const isAvailable = await isMongoDbAvailable();
    if (!isAvailable) {
      logger.error(
        'MongoDB server is not available. Please start the MongoDB server.',
      );
      throw new Error(
        'MongoDB server is not available. Please start the MongoDB server.',
      );
    }

    const dbUrl = loadDatabaseUrl();
    const client = new MongoClient(dbUrl);
    await client.connect();

    logger.log('Connected to MongoDB using MongoClient');
    return client;
  } catch (error) {
    logger.error('Failed to connect to MongoDB using MongoClient', error);
    throw error;
  }
}

// Mongoose connection
export async function connectMongoose() {
  try {
    // First check if MongoDB is available
    const isAvailable = await isMongoDbAvailable();
    if (!isAvailable) {
      logger.error(
        'MongoDB server is not available. Please start the MongoDB server.',
      );
      throw new Error(
        'MongoDB server is not available. Please start the MongoDB server.',
      );
    }

    const dbUrl = loadDatabaseUrl();
    await mongoose.connect(dbUrl);

    logger.log('Connected to MongoDB using Mongoose');
    return mongoose.connection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB using Mongoose', error);
    throw error;
  }
}

// Close Mongoose connection
export async function closeMongooseConnection() {
  try {
    await mongoose.connection.close();
    logger.log('Mongoose connection closed');
  } catch (error) {
    logger.error('Error closing Mongoose connection', error);
    throw error;
  }
}

// Import and register schemas for seeder
export async function registerSeederSchemas() {
  try {
    // We'll need to dynamically import these modules
    logger.log('Importing schema modules...');

    // Import User schema
    const { UsersSchema } = await import(
      '../../libs/common/src/database/users.schema'
    );

    // Import Shares schemas
    const { SharesOfferSchema, SharesSchema } = await import(
      '../../apps/shares/src/db/shares.schema'
    );

    // Import Chama schemas
    const { ChamasSchema } = await import(
      '../../apps/chama/src/chamas/db/chamas.schema'
    );
    const { ChamaWalletSchema } = await import(
      '../../apps/chama/src/wallet/db/wallet.schema'
    );

    // Import Solowallet schema
    const { SolowalletSchema } = await import(
      '../../apps/solowallet/src/db/solowallet.schema'
    );

    logger.log('Registering models...');

    // Register models with mongoose, using the correct "*documents" collection naming convention
    mongoose.model('User', UsersSchema, DB_SETTINGS.COLLECTIONS.USERS);
    mongoose.model(
      'SharesOffer',
      SharesOfferSchema,
      DB_SETTINGS.COLLECTIONS.SHARES_OFFER,
    );
    mongoose.model('SharesTx', SharesSchema, DB_SETTINGS.COLLECTIONS.SHARES);
    mongoose.model('Chama', ChamasSchema, DB_SETTINGS.COLLECTIONS.CHAMAS);
    mongoose.model(
      'ChamaWalletTx',
      ChamaWalletSchema,
      DB_SETTINGS.COLLECTIONS.CHAMA_WALLET,
    );
    mongoose.model(
      'SolowalletTx',
      SolowalletSchema,
      DB_SETTINGS.COLLECTIONS.SOLOWALLET,
    );

    logger.log('Models registered successfully');
  } catch (error) {
    logger.error('Error registering schemas', error);
    throw error;
  }
}

// Get the registered models (ensures they're registered)
export function getSeederModels() {
  return {
    User: mongoose.model('User'),
    SharesOffer: mongoose.model('SharesOffer'),
    SharesTx: mongoose.model('SharesTx'),
    Chama: mongoose.model('Chama'),
    ChamaWalletTx: mongoose.model('ChamaWalletTx'),
    SolowalletTx: mongoose.model('SolowalletTx'),
  };
}

// Clear collections for seeder
export async function clearSeederCollections() {
  try {
    const { User, SharesOffer, SharesTx, Chama, ChamaWalletTx, SolowalletTx } =
      getSeederModels();

    await User.deleteMany({});
    logger.log('Cleared Users collection');

    await SharesOffer.deleteMany({});
    logger.log('Cleared SharesOffer collection');

    await SharesTx.deleteMany({});
    logger.log('Cleared SharesTx collection');

    await Chama.deleteMany({});
    logger.log('Cleared Chama collection');

    await ChamaWalletTx.deleteMany({});
    logger.log('Cleared ChamaWalletTx collection');

    await SolowalletTx.deleteMany({});
    logger.log('Cleared SolowalletTx collection');

    // Also clean up any non-document collections that might have been created
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    // Clean up collections without "documents" suffix that might have been created by earlier runs
    const nonStandardCollections = collections
      .map((col) => col.name)
      .filter((name) => {
        const nonStandardNames = [
          'users',
          'sharesoffers',
          'sharestxes',
          'chamas',
          'chamawallettxes',
          'solowallettxes',
        ];
        return nonStandardNames.includes(name);
      });

    if (nonStandardCollections.length > 0) {
      logger.log(
        `Found ${nonStandardCollections.length} non-standard collections to clean up`,
      );

      for (const colName of nonStandardCollections) {
        await db.collection(colName).deleteMany({});
        logger.log(`Cleared ${colName} collection`);
      }
    }

    logger.log('All collections cleared');
  } catch (error) {
    logger.error('Error clearing collections', error);
    throw error;
  }
}

// Utility function for API key operations
export async function withMongoClient<T>(
  operation: (client: MongoClient) => Promise<T>,
): Promise<T> {
  try {
    const client = await getMongoClient();
    try {
      return await operation(client);
    } finally {
      await client.close();
      logger.log('MongoDB client connection closed');
    }
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
}
