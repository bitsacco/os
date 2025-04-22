import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb://bs:password@mongodb:27017';
const DB_NAME = 'bitsacco';
const COLLECTION_NAME = 'apikeys';
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
    // Generate a single secure key
    const keyBuffer = crypto.randomBytes(32);
    const key = keyBuffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const globalKey = `bsk_dev_global_${key.substring(0, 16)}`;
    
    // Hash the key for storage
    const salt = 'bitsacco-dev-salt-do-not-use-in-production';
    const keyHash = crypto.createHmac('sha256', salt).update(globalKey).digest('hex');
    
    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
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
    
    // Update all service .dev.env files with the global key
    for (const service of SERVICES) {
      const envFilePath = path.join(__dirname, '..', 'apps', service, '.dev.env');
      
      if (fs.existsSync(envFilePath)) {
        let envContent = fs.readFileSync(envFilePath, 'utf-8');
        
        // Add API key salt if not present
        if (!envContent.includes('API_KEY_SALT=')) {
          envContent += '\n# API key configuration\nAPI_KEY_SALT=bitsacco-dev-salt-do-not-use-in-production\n';
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
    const rootEnvPath = path.join(__dirname, '..', '.dev.env');
    if (fs.existsSync(rootEnvPath)) {
      let rootEnvContent = fs.readFileSync(rootEnvPath, 'utf-8');
      const globalKeyRegex = /^GLOBAL_API_KEY=.*/m;
      if (globalKeyRegex.test(rootEnvContent)) {
        rootEnvContent = rootEnvContent.replace(globalKeyRegex, `GLOBAL_API_KEY=${globalKey}`);
      } else {
        rootEnvContent += `\nGLOBAL_API_KEY=${globalKey}\n`;
      }
      fs.writeFileSync(rootEnvPath, rootEnvContent);
      console.log(`Updated root .dev.env with global API key`);
    } else {
      fs.writeFileSync(rootEnvPath, `GLOBAL_API_KEY=${globalKey}\n`);
      console.log(`Created root .dev.env with global API key`);
    }
    
    await client.close();
    console.log('======================================');
    console.log('Global API key generation completed successfully!');
    console.log('Global API key: ' + globalKey);
    console.log('IMPORTANT: This key has access to ALL services. Do not use in production!');
    console.log('======================================');
    
  } catch (error) {
    console.error('Error generating global API key:', error);
  }
}

generateGlobalDevKey().catch(console.error);