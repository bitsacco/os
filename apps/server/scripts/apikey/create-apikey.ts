import * as crypto from 'crypto';
import * as readline from 'readline';
import { withMongoClient, DB_SETTINGS } from '../utils/db';

// Available scopes
const AVAILABLE_SCOPES = [
  // User-related scopes
  'user:read',
  'user:write',

  // Transaction-related scopes
  'transaction:read',
  'transaction:write',

  // Financial scopes
  'shares:read',
  'shares:write',
  'solowallet:read',
  'solowallet:write',
  'chama:read',
  'chama:write',

  // Admin scopes
  'admin:access',

  // Service-to-service scopes
  'service:auth',
  'service:sms',
  'service:nostr',
  'service:shares',
  'service:solowallet',
  'service:chama',
  'service:notification',
  'service:swap',
];

// Create a readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createApiKey() {
  console.log('API Key Creation Utility');
  console.log('='.repeat(50));

  try {
    // Get key details from user
    const name = await askQuestion('Enter a name for the API key: ');
    const ownerId = await askQuestion(
      'Enter owner ID (e.g., user ID or "system"): ',
    );

    // Show available scopes
    console.log('\nAvailable scopes:');
    AVAILABLE_SCOPES.forEach((scope, index) => {
      console.log(`${index + 1}. ${scope}`);
    });

    const scopeInput = await askQuestion(
      '\nEnter scope numbers (comma-separated, e.g., "1,3,5") or "all" for all scopes: ',
    );

    let selectedScopes: string[] = [];

    // Check if the user wants all scopes
    if (scopeInput.trim().toLowerCase() === 'all') {
      selectedScopes = [...AVAILABLE_SCOPES];
    } else {
      // Parse the scope indices
      const selectedScopeIndices = scopeInput
        .split(',')
        .map((i) => parseInt(i.trim()) - 1);

      // Validate selections
      selectedScopes = selectedScopeIndices
        .filter((i) => i >= 0 && i < AVAILABLE_SCOPES.length)
        .map((i) => AVAILABLE_SCOPES[i]);

      if (selectedScopes.length === 0) {
        throw new Error('No valid scopes selected');
      }
    }

    console.log(`\nSelected scopes: ${selectedScopes.join(', ')}`);

    const expiryDaysInput = await askQuestion(
      'Enter expiry in days (or "permanent" for non-expiring key): ',
    );
    const isPermanent = expiryDaysInput.toLowerCase() === 'permanent';
    const expiryDays = isPermanent ? 3650 : parseInt(expiryDaysInput); // 10 years for "permanent"

    if (isNaN(expiryDays)) {
      throw new Error('Invalid expiry days');
    }

    const isServiceKey = await askQuestion('Is this a service key? (y/n): ');
    let serviceName = null;

    if (isServiceKey.toLowerCase() === 'y') {
      serviceName = await askQuestion('Enter service name: ');
    }

    // Generate API key
    const keyBuffer = crypto.randomBytes(32);
    const key = keyBuffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const prefix = isServiceKey.toLowerCase() === 'y' ? 'bsk_svc_' : 'bsk_';
    const fullKey = `${prefix}${key}`;

    // Hash the key
    // Using the default salt value from ApiKeyService
    const salt = 'bitsacco-api-salt';
    const keyHash = crypto
      .createHmac('sha256', salt)
      .update(fullKey)
      .digest('hex');

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Connect to MongoDB and create the API key
    await withMongoClient(async (client) => {
      const db = client.db(DB_SETTINGS.DB_NAME);
      const collection = db.collection(DB_SETTINGS.COLLECTIONS.APIKEYS);

      // Prepare metadata
      const metadata: Record<string, any> = {};
      if (isServiceKey.toLowerCase() === 'y' && serviceName) {
        metadata.isServiceKey = true;
        metadata.serviceName = serviceName;
      }

      // Store the key
      const result = await collection.insertOne({
        keyHash,
        name,
        ownerId,
        scopes: selectedScopes,
        expiresAt,
        revoked: false,
        isPermanent,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata,
      });

      console.log('\n='.repeat(50));
      console.log('API key created successfully!');
      console.log(`API Key: ${fullKey}`);
      console.log(`ID: ${result.insertedId}`);
      console.log(`Name: ${name}`);
      console.log(`Expires: ${expiresAt.toLocaleString()}`);
      console.log(`Scopes: ${selectedScopes.join(', ')}`);
      console.log('='.repeat(50));
      console.log(
        "IMPORTANT: Save this API key somewhere safe. You won't be able to see it again!",
      );
    });
  } catch (error) {
    console.error('Error creating API key:', error);
  } finally {
    rl.close();
  }
}

createApiKey().catch(console.error);
