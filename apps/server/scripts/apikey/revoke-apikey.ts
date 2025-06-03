import * as readline from 'readline';
import { ObjectId } from 'mongodb';
import { withMongoClient, DB_SETTINGS, isMongoDbAvailable } from '../utils/db';

// Create a readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function listKeys() {
  console.log('Fetching available API keys...\n');

  const keys = await withMongoClient(async (client) => {
    const db = client.db(DB_SETTINGS.DB_NAME);
    const collection = db.collection(DB_SETTINGS.COLLECTIONS.APIKEYS);

    return await collection.find({}).toArray();
  });

  console.log(`Found ${keys.length} API keys:\n`);

  keys.forEach((key, index) => {
    const status = key.revoked
      ? '🚫 REVOKED'
      : key.expiresAt < new Date()
        ? '⏱️ EXPIRED'
        : '✅ ACTIVE';
    console.log(`${index + 1}. ${key._id} - ${key.name} (${status})`);
    console.log(`   Owner: ${key.ownerId}`);
    console.log(`   Expires: ${new Date(key.expiresAt).toLocaleString()}`);
    console.log(`   Scopes: ${(key.scopes || []).join(', ')}`);
    console.log('');
  });

  return keys;
}

async function revokeApiKey() {
  console.log('API Key Revocation Utility');
  console.log('='.repeat(50));

  try {
    // First check if MongoDB is available
    const dbAvailable = await isMongoDbAvailable();
    if (!dbAvailable) {
      console.error('🛑 MongoDB server is not available!');
      console.error(
        'Make sure MongoDB is running on localhost:27017 or use docker-compose.',
      );
      console.error('\nYou can start MongoDB using:');
      console.error('  - Docker: docker compose -p os up');
      console.error('  - Local MongoDB: mongod --dbpath=/path/to/data');
      return;
    }

    // List available keys
    const keys = await listKeys();

    if (keys.length === 0) {
      console.log('No API keys found in the database.');
      rl.close();
      return;
    }

    // Get key selection from user
    const selection = await askQuestion(
      'Enter the number of the key to revoke (or "all" to see full list): ',
    );

    if (selection.toLowerCase() === 'all') {
      // Already displayed all keys
      const keyNum = await askQuestion(
        'Enter the number of the key to revoke: ',
      );
      const index = parseInt(keyNum) - 1;

      if (isNaN(index) || index < 0 || index >= keys.length) {
        throw new Error(`Invalid selection: ${keyNum}`);
      }

      await processRevocation(keys[index]);
    } else {
      const index = parseInt(selection) - 1;

      if (isNaN(index) || index < 0 || index >= keys.length) {
        throw new Error(`Invalid selection: ${selection}`);
      }

      await processRevocation(keys[index]);
    }
  } catch (error) {
    console.error('Error revoking API key:', error);
  } finally {
    rl.close();
  }
}

async function processRevocation(key: any) {
  // Display key details
  console.log('\nAPI Key Details:');
  console.log(`ID: ${key._id}`);
  console.log(`Name: ${key.name}`);
  console.log(`Owner ID: ${key.ownerId}`);
  console.log(`Created: ${new Date(key.createdAt).toLocaleString()}`);
  console.log(`Expires: ${new Date(key.expiresAt).toLocaleString()}`);
  console.log(`Scopes: ${(key.scopes || []).join(', ')}`);

  if (key.revoked) {
    console.log('\nThis API key is already revoked.');
    return;
  }

  // Confirm revocation
  const confirm = await askQuestion(
    '\nAre you sure you want to revoke this API key? (y/n): ',
  );

  if (confirm.toLowerCase() !== 'y') {
    console.log('Revocation cancelled.');
    return;
  }

  // Revoke the key
  await withMongoClient(async (client) => {
    const db = client.db(DB_SETTINGS.DB_NAME);
    const collection = db.collection(DB_SETTINGS.COLLECTIONS.APIKEYS);

    const result = await collection.updateOne(
      { _id: new ObjectId(key._id) },
      {
        $set: {
          revoked: true,
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount === 1) {
      console.log('\n✅ API key revoked successfully!');
    } else {
      console.log('\n⚠️ No changes made. Key may already be revoked.');
    }
  });
}

revokeApiKey().catch(console.error);
