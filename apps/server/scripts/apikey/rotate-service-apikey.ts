import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import * as readline from 'readline';

// MongoDB connection settings
const MONGODB_URI = 'mongodb://bs:password@mongodb:27017';
const DB_NAME = 'bitsacco';
const COLLECTION_NAME = 'apikeys';

// Available services
const SERVICES = [
  'auth',
  'sms',
  'nostr',
  'shares',
  'solowallet',
  'chama',
  'notification',
  'swap',
  'api',
];

// Service to scope mapping
const SERVICE_SCOPES: Record<string, string[]> = {
  auth: ['service:auth'],
  sms: ['service:sms'],
  nostr: ['service:nostr'],
  shares: ['service:shares'],
  solowallet: ['service:solowallet'],
  chama: ['service:chama'],
  notification: ['service:notification'],
  swap: ['service:swap'],
  api: [
    'service:auth',
    'service:sms',
    'service:nostr',
    'service:shares',
    'service:solowallet',
    'service:chama',
    'service:notification',
    'service:swap',
  ],
};

// Create a readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function rotateServiceApiKey() {
  console.log('Service API Key Rotation Utility');
  console.log('='.repeat(50));

  try {
    // List available services
    console.log('Available services:');
    SERVICES.forEach((service, index) => {
      console.log(`${index + 1}. ${service}`);
    });

    // Get service selection from user
    const serviceIndexInput = await askQuestion(
      '\nSelect a service to rotate its API key (1-9): ',
    );
    const serviceIndex = parseInt(serviceIndexInput) - 1;

    if (
      isNaN(serviceIndex) ||
      serviceIndex < 0 ||
      serviceIndex >= SERVICES.length
    ) {
      throw new Error('Invalid service selection');
    }

    const serviceName = SERVICES[serviceIndex];
    const serviceScopes = SERVICE_SCOPES[serviceName];

    console.log(
      `\nRotating API key for ${serviceName} service with scopes: ${serviceScopes.join(', ')}`,
    );

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Find current service key
    const currentKey = await collection.findOne({
      'metadata.isServiceKey': true,
      'metadata.serviceName': serviceName,
      revoked: false,
    });

    if (currentKey) {
      console.log(
        `Found existing API key for ${serviceName}: ${currentKey._id}`,
      );

      // Confirm rotation
      const confirm = await askQuestion(
        '\nAre you sure you want to rotate this service key? (y/n): ',
      );

      if (confirm.toLowerCase() !== 'y') {
        console.log('Rotation cancelled.');
        await client.close();
        rl.close();
        return;
      }
    }

    // Generate new API key
    const keyBuffer = crypto.randomBytes(32);
    const key = keyBuffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const fullKey = `bsk_svc_${serviceName}_${key.substring(0, 16)}`;

    // Hash the key
    const salt = 'bitsacco-dev-salt-do-not-use-in-production';
    const keyHash = crypto
      .createHmac('sha256', salt)
      .update(fullKey)
      .digest('hex');

    // Calculate expiration date - 1 year
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Create new key
    const newKeyResult = await collection.insertOne({
      keyHash,
      name: `Service: ${serviceName} (rotated)`,
      ownerId: 'system',
      scopes: serviceScopes,
      expiresAt,
      revoked: false,
      isPermanent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        isServiceKey: true,
        serviceName: serviceName,
        rotationDate: new Date().toISOString(),
      },
    });

    // Mark old key as revoked
    if (currentKey) {
      await collection.updateOne(
        { _id: currentKey._id },
        { $set: { revoked: true, updatedAt: new Date() } },
      );
      console.log(`Revoked old API key: ${currentKey._id}`);
    }

    // Update service .env file with new key
    const envFileName = '.dev.env';
    const envFilePath = path.join(
      __dirname,
      '..',
      'apps',
      serviceName,
      envFileName,
    );
    const envVar = `${serviceName.toUpperCase()}_API_KEY`;

    if (fs.existsSync(envFilePath)) {
      let envContent = fs.readFileSync(envFilePath, 'utf-8');

      const keyRegex = new RegExp(`^${envVar}=.*`, 'm');
      if (keyRegex.test(envContent)) {
        envContent = envContent.replace(keyRegex, `${envVar}=${fullKey}`);
      } else {
        envContent += `\n${envVar}=${fullKey}\n`;
      }

      fs.writeFileSync(envFilePath, envContent);
      console.log(`Updated ${envFilePath} with new API key`);
    } else {
      console.log(
        `Warning: Environment file for ${serviceName} not found: ${envFilePath}`,
      );
    }

    console.log('\n='.repeat(50));
    console.log('Service API key rotated successfully!');
    console.log(`New API Key: ${fullKey}`);
    console.log(`ID: ${newKeyResult.insertedId}`);
    console.log(`Service: ${serviceName}`);
    console.log(`Expires: ${expiresAt.toLocaleString()}`);
    console.log(`Scopes: ${serviceScopes.join(', ')}`);
    console.log('='.repeat(50));
    console.log(
      'IMPORTANT: Save this API key somewhere safe and update your service configuration!',
    );

    await client.close();
  } catch (error) {
    console.error('Error rotating service API key:', error);
  } finally {
    rl.close();
  }
}

rotateServiceApiKey().catch(console.error);
