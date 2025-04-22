import * as crypto from 'crypto';
import { withMongoClient, DB_SETTINGS, isMongoDbAvailable } from '../utils/db';
import { readGlobalApiKey } from './utils';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Diagnostic tool to check API key validation
async function runDiagnostic() {
  console.log('=== API Key Authentication Diagnostic Tool ===');
  console.log('This script will help diagnose issues with API key authentication');
  
  // Step 1: Check if MongoDB is available
  console.log('\n[1] Checking MongoDB connection...');
  const dbAvailable = await isMongoDbAvailable();
  if (!dbAvailable) {
    console.error('❌ MongoDB server is not available!');
    return;
  }
  console.log('✅ MongoDB is available');
  
  // Step 2: Read API key from environment files
  console.log('\n[2] Reading API key from environment files...');
  const globalApiKey = readGlobalApiKey();
  if (!globalApiKey) {
    console.error('❌ No API key found in environment files');
    return;
  }
  
  console.log(`✅ Found API key: ${globalApiKey.substring(0, 16)}...`);
  
  // Step 3: Check environment variables
  console.log('\n[3] Checking environment variables...');
  
  let configuredSalt = null;
  const rootEnvPath = path.join(__dirname, '../..', '.dev.env');
  
  if (fs.existsSync(rootEnvPath)) {
    const envContent = fs.readFileSync(rootEnvPath, 'utf-8');
    
    // Extract API_KEY_SALT
    const saltMatch = envContent.match(/API_KEY_SALT=([^\n]+)/);
    if (saltMatch) {
      configuredSalt = saltMatch[1];
      console.log(`✅ Found API_KEY_SALT in root .dev.env: ${configuredSalt}`);
    } else {
      console.log('⚠️ No API_KEY_SALT configured in root .dev.env');
    }
  } else {
    console.error('❌ Root .dev.env file not found');
  }
  
  // Check API service .env file
  const apiEnvPath = path.join(__dirname, '../../apps/api', '.dev.env');
  if (fs.existsSync(apiEnvPath)) {
    const envContent = fs.readFileSync(apiEnvPath, 'utf-8');
    const saltMatch = envContent.match(/API_KEY_SALT=([^\n]+)/);
    if (saltMatch) {
      console.log(`✅ Found API_KEY_SALT in API .dev.env: ${saltMatch[1]}`);
      if (configuredSalt && saltMatch[1] !== configuredSalt) {
        console.error('⚠️ API service is using a different salt than root .dev.env!');
      }
    } else {
      console.log('⚠️ No API_KEY_SALT configured in API .dev.env');
    }
  } else {
    console.log('⚠️ API .dev.env file not found');
  }
  
  // Step 4: Check API keys in the database
  console.log('\n[4] Checking API keys in database...');
  await withMongoClient(async (client) => {
    const db = client.db(DB_SETTINGS.DB_NAME);
    const collection = db.collection(DB_SETTINGS.COLLECTIONS.APIKEYS);
    
    // Find keys with global dev key metadata
    const globalKeys = await collection.find({ 
      'metadata.isGlobalDevKey': true 
    }).toArray();
    
    const allKeys = await collection.find({}).toArray();
    console.log(`Found ${allKeys.length} total API keys in database`);
    
    if (globalKeys.length > 0) {
      console.log(`Found ${globalKeys.length} global dev API key(s)`);
      
      // Focus on the global key for testing
      const key = globalKeys[0];
      console.log(`\n  Key details:`);
      console.log(`  - ID: ${key._id}`);
      console.log(`  - Name: ${key.name}`);
      console.log(`  - Hash: ${key.keyHash.substring(0, 10)}...`);
      console.log(`  - Revoked: ${key.revoked}`);
      console.log(`  - Expires: ${new Date(key.expiresAt).toLocaleString()}`);
      console.log(`  - Scopes: ${key.scopes.length} scopes`);
      
      // Rehash the API key with different salts to check which one works
      console.log('\n  Testing API key hash with different salt values:');
      
      // Try default salt
      const defaultSalt = 'bitsacco-api-salt';
      const defaultHash = crypto.createHmac('sha256', defaultSalt).update(globalApiKey).digest('hex');
      const defaultMatch = defaultHash === key.keyHash;
      console.log(`  - Default salt: ${defaultMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
      
      // Try old salt
      const oldSalt = 'bitsacco-dev-salt-do-not-use-in-production';
      const oldHash = crypto.createHmac('sha256', oldSalt).update(globalApiKey).digest('hex');
      const oldMatch = oldHash === key.keyHash;
      console.log(`  - Old dev salt: ${oldMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
      
      // Try configured salt
      if (configuredSalt && configuredSalt !== defaultSalt) {
        const configHash = crypto.createHmac('sha256', configuredSalt).update(globalApiKey).digest('hex');
        const configMatch = configHash === key.keyHash;
        console.log(`  - Configured salt: ${configMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
      }
      
      // Query for matching hash
      console.log('\n  Verifying database queries:');
      
      const matchDefault = await collection.findOne({ keyHash: defaultHash });
      console.log(`  - Default salt query: ${matchDefault ? '✅ MATCH FOUND' : '❌ NO MATCH'}`);
      
      const matchOld = await collection.findOne({ keyHash: oldHash });
      console.log(`  - Old salt query: ${matchOld ? '✅ MATCH FOUND' : '❌ NO MATCH'}`);
    } else {
      console.log('⚠️ No global API keys found. Using first available key for testing.');
      
      if (allKeys.length > 0) {
        const key = allKeys[0];
        console.log(`  Using key: ${key.name} (${key._id})`);
        
        // Rehash the API key with different salts
        console.log('\n  Testing API key hash with different salt values:');
        
        // Try default salt
        const defaultSalt = 'bitsacco-api-salt';
        const defaultHash = crypto.createHmac('sha256', defaultSalt).update(globalApiKey).digest('hex');
        const defaultMatch = defaultHash === key.keyHash;
        console.log(`  - Default salt: ${defaultMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
        
        // Try old salt
        const oldSalt = 'bitsacco-dev-salt-do-not-use-in-production';
        const oldHash = crypto.createHmac('sha256', oldSalt).update(globalApiKey).digest('hex');
        const oldMatch = oldHash === key.keyHash;
        console.log(`  - Old dev salt: ${oldMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
      }
    }
  });
  
  // Step 5: Test API endpoint
  console.log('\n[5] Testing API key authentication with the API gateway...');
  
  try {
    // First, try the public endpoint
    console.log('\n  Testing public health endpoint (no authentication required)...');
    try {
      const publicResponse = await axios.get('http://localhost:4000/v1/health/public', {
        timeout: 5000
      });
      console.log(`  ✅ Public Health Endpoint Status: ${publicResponse.status}`);
    } catch (publicError) {
      if (publicError.code === 'ECONNREFUSED') {
        console.error('  ❌ API server is not running. Please start the API with "bun dev"');
        console.log('\n⚠️ Diagnostic incomplete - API server is not running');
        return;
      } else {
        console.error(`  ⚠️ Public health endpoint error: ${publicError.message}`);
      }
    }

    // Test the authenticated endpoint
    console.log('\n  Testing authenticated health endpoint with API key...');
    try {
      const response = await axios.get('http://localhost:4000/v1/health', {
        headers: {
          'x-api-key': globalApiKey,
        },
        timeout: 5000
      });
      
      console.log('  ✅ API key authentication successful!');
      console.log(`  Status: ${response.status}`);
    } catch (error) {
      console.error('  ❌ API key authentication failed:');
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Message: ${error.response.data.message || 'No message'}`);
        
        if (error.response.status === 401) {
          console.log('\n[6] Authentication troubleshooting suggestions:');
          console.log('  - Check if API_KEY_SALT is set consistently in all services');
          console.log('  - Ensure the API service was restarted after updating the salt value');
          console.log('  - Verify API key in database has required scopes (should include service:api)');
          console.log('  - Try generating a new global key with "bun apikey:generate"');
          console.log('  - Check that API service can connect to MongoDB correctly');
        }
      } else {
        console.error(`  Error: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
  
  console.log('\n=== Diagnostic complete ===');
}

runDiagnostic().catch(console.error);