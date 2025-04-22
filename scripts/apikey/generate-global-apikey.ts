import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { withMongoClient, DB_SETTINGS, isMongoDbAvailable } from '../utils/db';
const SERVICES = [
  'auth', 'sms', 'nostr', 'shares', 'solowallet', 
  'chama', 'notification', 'swap', 'api'
];

// List of all possible scopes to assign to the global key
const ALL_SCOPES = [
  // Service-to-service scopes
  ...SERVICES.map(service => `service:${service}`),
  
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
];

async function generateGlobalDevKey() {
  console.log('Generating global development API key...');

  try {
    // Check if MongoDB is available
    const dbAvailable = await isMongoDbAvailable();
    if (!dbAvailable) {
      console.error('\n🛑 MongoDB server is not available!');
      console.error('Make sure MongoDB is running on localhost:27017 or use docker-compose.');
      console.error('\nYou can start MongoDB using:');
      console.error('  - Docker: docker compose -p os up');
      console.error('  - Local MongoDB: mongod --dbpath=/path/to/data');
      return;
    }
    
    // Generate a single secure key
    const keyBuffer = crypto.randomBytes(32);
    const key = keyBuffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const globalKey = `bsk_dev_global_${key.substring(0, 16)}`;
    
    // Hash the key for storage
    // Using the default salt value from ApiKeyService
    const salt = 'bitsacco-api-salt';
    const keyHash = crypto.createHmac('sha256', salt).update(globalKey).digest('hex');
    
    // Use our common database utility
    await withMongoClient(async (client) => {
      const db = client.db(DB_SETTINGS.DB_NAME);
      const collection = db.collection(DB_SETTINGS.COLLECTIONS.APIKEYS);
      
      console.log('Connected to MongoDB, checking for existing global keys...');
      
      // Delete any existing global keys
      const deleteResult = await collection.deleteMany({ 
        'metadata.isGlobalDevKey': true,
        ownerId: 'system'
      });
      
      console.log(`Deleted ${deleteResult.deletedCount} existing global dev keys`);
      
      // Create expiration date - 1 year
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      
      // Store the key with ALL scopes
      await collection.insertOne({
        keyHash,
        name: 'Global Development API Key',
        ownerId: 'system',
        // Add all possible scopes to this single key
        scopes: ALL_SCOPES,
        expiresAt,
        revoked: false,
        isPermanent: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          isGlobalDevKey: true,
          environment: 'development'
        }
      });
      
      console.log('Global API key created and stored in database');
    });
    
    // Update all service .dev.env files with the global key
    for (const service of SERVICES) {
      const envFilePath = path.join(__dirname, '../../apps', service, '.dev.env');
      
      if (fs.existsSync(envFilePath)) {
        let envContent = fs.readFileSync(envFilePath, 'utf-8');
        
        // Update or add API key salt
        const apiKeySaltRegex = /^API_KEY_SALT=.*/m;
        if (apiKeySaltRegex.test(envContent)) {
          // Replace existing salt
          envContent = envContent.replace(apiKeySaltRegex, 'API_KEY_SALT=bitsacco-api-salt');
        } else {
          // Add new salt configuration
          envContent += '\n# API key configuration\nAPI_KEY_SALT=bitsacco-api-salt\n';
        }
        
        // Add GLOBAL_API_KEY for all services to use
        const globalKeyRegex = /^GLOBAL_API_KEY=.*/m;
        if (globalKeyRegex.test(envContent)) {
          envContent = envContent.replace(globalKeyRegex, `GLOBAL_API_KEY=${globalKey}`);
        } else {
          envContent += `GLOBAL_API_KEY=${globalKey}\n`;
        }
        
        fs.writeFileSync(envFilePath, envContent);
        console.log(`Updated ${envFilePath} with global API key`);
      } else {
        console.log(`Warning: Environment file for ${service} not found: ${envFilePath}`);
      }
    }
    
    // Make sure root .dev.env also has the key
    const rootEnvPath = path.join(__dirname, '../..', '.dev.env');
    if (fs.existsSync(rootEnvPath)) {
      let rootEnvContent = fs.readFileSync(rootEnvPath, 'utf-8');
      
      // Update or add API key salt
      const apiKeySaltRegex = /^API_KEY_SALT=.*/m;
      if (apiKeySaltRegex.test(rootEnvContent)) {
        // Replace existing salt
        rootEnvContent = rootEnvContent.replace(apiKeySaltRegex, 'API_KEY_SALT=bitsacco-api-salt');
      } else {
        // Add new salt configuration
        rootEnvContent += '\n# API key configuration\nAPI_KEY_SALT=bitsacco-api-salt\n';
      }
      
      // Update or add global API key
      const globalKeyRegex = /^GLOBAL_API_KEY=.*/m;
      if (globalKeyRegex.test(rootEnvContent)) {
        rootEnvContent = rootEnvContent.replace(globalKeyRegex, `GLOBAL_API_KEY=${globalKey}`);
      } else {
        rootEnvContent += `GLOBAL_API_KEY=${globalKey}\n`;
      }
      
      fs.writeFileSync(rootEnvPath, rootEnvContent);
      console.log(`Updated root .dev.env with global API key and salt`);
    } else {
      fs.writeFileSync(rootEnvPath, `# API key configuration\nAPI_KEY_SALT=bitsacco-api-salt\nGLOBAL_API_KEY=${globalKey}\n`);
      console.log(`Created root .dev.env with global API key and salt`);
    }
    
    console.log('======================================');
    console.log('Global API key generation completed successfully!');
    console.log('Global API key: ' + globalKey);
    console.log('IMPORTANT: This key has access to ALL services. Do not use in production!');
    console.log('======================================');
    
  } catch (error) {
    console.error('Error generating global API key:', error.message || error);
  }
}

generateGlobalDevKey().catch(console.error);