import { withMongoClient, DB_SETTINGS, isMongoDbAvailable } from '../utils/db';

async function listApiKeys() {
  // Check for help flag early
  if (process.argv.includes('--help')) {
    console.log('Usage: bun apikey:list [options]');
    console.log('\nList all API keys in the database');
    return;
  }

  console.log('Listing all API keys in the database...');

  try {
    // Check if MongoDB is available
    const dbAvailable = await isMongoDbAvailable();
    if (!dbAvailable) {
      console.error('\n🛑 MongoDB server is not available!');
      console.error(
        'Make sure MongoDB is running on localhost:27017 or use docker-compose.',
      );
      console.error('\nYou can start MongoDB using:');
      console.error('  - Docker: docker compose -p os up');
      console.error('  - Local MongoDB: mongod --dbpath=/path/to/data');
      return;
    }

    // Use the common database utility
    await withMongoClient(async (client) => {
      const db = client.db(DB_SETTINGS.DB_NAME);
      const collection = db.collection(DB_SETTINGS.COLLECTIONS.APIKEYS);

      console.log('Connected to MongoDB, fetching API keys...');

      // Get all API keys
      const apiKeys = await collection.find({}).toArray();

      if (apiKeys.length === 0) {
        console.log('No API keys found in the database.');
        return;
      }

      console.log(`Found ${apiKeys.length} API keys:`);
      console.log('='.repeat(80));

      // Format and display API keys
      for (const key of apiKeys) {
        const isGlobalDev = key.metadata?.isGlobalDevKey
          ? '[GLOBAL DEV KEY]'
          : '';
        const isServiceKey = key.metadata?.isServiceKey
          ? `[SERVICE: ${key.metadata.serviceName}]`
          : '';
        const status = key.revoked
          ? 'REVOKED'
          : key.expiresAt < new Date()
            ? 'EXPIRED'
            : 'ACTIVE';
        const lastUsed = key.lastUsed
          ? new Date(key.lastUsed).toLocaleString()
          : 'Never';

        console.log(`ID: ${key._id}`);
        console.log(`Name: ${key.name} ${isGlobalDev} ${isServiceKey}`);
        console.log(`Owner ID: ${key.ownerId}`);
        console.log(`Status: ${status}`);
        console.log(`Created: ${new Date(key.createdAt).toLocaleString()}`);
        console.log(`Expires: ${new Date(key.expiresAt).toLocaleString()}`);
        console.log(`Last Used: ${lastUsed}`);
        console.log(`Scopes: ${key.scopes.join(', ')}`);
        console.log('='.repeat(80));
      }

      console.log('Listing complete!');
    });
  } catch (error) {
    console.error('Error listing API keys:', error.message);
  }
}

listApiKeys().catch(console.error);
