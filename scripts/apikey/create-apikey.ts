import * as crypto from 'crypto';
import * as readline from 'readline';
import { withMongoClient, DB_SETTINGS } from '../utils/db';

// Available scopes matching our simplified enum
const AVAILABLE_SCOPES = [
  // General scopes
  'read',
  'write',
  
  // Resource-specific scopes
  'users:read',
  'users:write',
  'transactions:read',
  'transactions:write',
  'shares:read',
  'shares:write',
  'solowallet:read',
  'solowallet:write',
  'chama:read',
  'chama:write',
  
  // Admin scopes
  'admin:access',
];

// Create a readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createApiKey() {
  console.log('API Key Creation Utility');
  console.log('='.repeat(50));
  
  try {
    // Get key details from user
    const name = await askQuestion('Enter a name for the API key: ');
    const userId = await askQuestion('Enter user ID: ');
    
    // Show available scopes
    console.log('\nAvailable scopes:');
    AVAILABLE_SCOPES.forEach((scope, index) => {
      console.log(`${index + 1}. ${scope}`);
    });
    
    const scopeInput = await askQuestion('\nEnter scope numbers (comma-separated, e.g., "1,3,5"): ');
    
    // Parse the scope indices
    const selectedScopeIndices = scopeInput.split(',').map(i => parseInt(i.trim()) - 1);
    
    // Validate selections
    const selectedScopes = selectedScopeIndices
      .filter(i => i >= 0 && i < AVAILABLE_SCOPES.length)
      .map(i => AVAILABLE_SCOPES[i]);
    
    if (selectedScopes.length === 0) {
      throw new Error('No valid scopes selected');
    }
    
    console.log(`\nSelected scopes: ${selectedScopes.join(', ')}`);
    
    const expiryDaysInput = await askQuestion('Enter expiry in days (default: 90): ');
    const expiryDays = expiryDaysInput ? parseInt(expiryDaysInput) : 90;
    
    if (isNaN(expiryDays) || expiryDays <= 0) {
      throw new Error('Invalid expiry days');
    }
    
    // Generate API key
    const keyBuffer = crypto.randomBytes(32);
    const key = keyBuffer.toString('base64url');
    const fullKey = `bsk_${key}`;
    
    // Hash the key
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    
    // Connect to MongoDB and create the API key
    await withMongoClient(async (client) => {
      const db = client.db(DB_SETTINGS.DB_NAME);
      const collection = db.collection(DB_SETTINGS.COLLECTIONS.APIKEYS);
      
      // Store the key
      const result = await collection.insertOne({
        keyHash,
        name,
        userId,
        scopes: selectedScopes,
        expiresAt,
        revoked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log('\n' + '='.repeat(50));
      console.log('API key created successfully!');
      console.log(`API Key: ${fullKey}`);
      console.log(`ID: ${result.insertedId}`);
      console.log(`Name: ${name}`);
      console.log(`Expires: ${expiresAt.toLocaleString()}`);
      console.log(`Scopes: ${selectedScopes.join(', ')}`);
      console.log('='.repeat(50));
      console.log('IMPORTANT: Save this API key somewhere safe. You won\'t be able to see it again!');
    });
  } catch (error) {
    console.error('Error creating API key:', error);
  } finally {
    rl.close();
  }
}

createApiKey().catch(console.error);