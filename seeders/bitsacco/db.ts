import mongoose from 'mongoose';
import { Logger } from '@nestjs/common';

// Create a logger for the seeders
const logger = new Logger('SeedersDB');

// Connect to MongoDB
export async function connectToDatabase() {
  try {
    await mongoose.connect('mongodb://bs:password@localhost:27017');
    logger.log('Connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', error);
    throw error;
  }
}

// Close MongoDB connection
export async function closeDatabaseConnection() {
  try {
    await mongoose.connection.close();
    logger.log('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection', error);
    throw error;
  }
}

// Import and register schemas when database is connected
export async function registerSchemas() {
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
    mongoose.model('User', UsersSchema, 'usersdocuments');
    mongoose.model('SharesOffer', SharesOfferSchema, 'sharesofferdocuments');
    mongoose.model('SharesTx', SharesSchema, 'sharesdocuments');
    mongoose.model('Chama', ChamasSchema, 'chamasdocuments');
    mongoose.model('ChamaWalletTx', ChamaWalletSchema, 'chamawalletdocuments');
    mongoose.model('SolowalletTx', SolowalletSchema, 'solowalletdocuments');

    logger.log('Models registered successfully');
  } catch (error) {
    logger.error('Error registering schemas', error);
    throw error;
  }
}

// Get the models (ensures they're registered)
export function getModels() {
  return {
    User: mongoose.model('User'),
    SharesOffer: mongoose.model('SharesOffer'),
    SharesTx: mongoose.model('SharesTx'),
    Chama: mongoose.model('Chama'),
    ChamaWalletTx: mongoose.model('ChamaWalletTx'),
    SolowalletTx: mongoose.model('SolowalletTx'),
  };
}

// Function to clear all collections
export async function clearCollections() {
  try {
    const { User, SharesOffer, SharesTx, Chama, ChamaWalletTx, SolowalletTx } =
      getModels();

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
