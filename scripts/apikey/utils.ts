import * as fs from 'fs';
import * as path from 'path';

// Read the global API key from environment files
export function readGlobalApiKey(): string | null {
  try {
    // Check if .dev.env exists in root
    const envPath = path.join(__dirname, '../..', '.dev.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/GLOBAL_API_KEY=([^\s]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Check common service env files
    const services = ['api', 'auth', 'shares', 'swap', 'notification'];
    for (const service of services) {
      const serviceEnvPath = path.join(__dirname, '../../apps', service, '.dev.env');
      if (fs.existsSync(serviceEnvPath)) {
        const envContent = fs.readFileSync(serviceEnvPath, 'utf-8');
        const match = envContent.match(/GLOBAL_API_KEY=([^\s]+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    
    // If no API key found in env files, try to get one from the database
    console.log('No API key found in environment files. Trying to fetch from database...');
    const { DB_SETTINGS, withMongoClient } = require('../utils/db');
    
    // We need to return a Promise here, but the function is synchronous
    // So we'll set a flag to indicate we're checking the DB
    (global as any).__checking_db = true;
    
    withMongoClient(async (client) => {
      try {
        const db = client.db(DB_SETTINGS.DB_NAME);
        const collection = db.collection(DB_SETTINGS.COLLECTIONS.APIKEYS);
        
        // Look for a global dev key
        const globalKey = await collection.findOne({ 
          'metadata.isGlobalDevKey': true,
          'revoked': false
        });
        
        if (globalKey) {
          console.log('Found global API key in database.');
          (global as any).__api_key = globalKey;
        } else {
          console.log('No global API key found in database.');
        }
      } catch (dbError) {
        console.error('Error accessing database:', dbError);
      } finally {
        (global as any).__checking_db = false;
      }
    }).catch((err) => {
      console.error('Error connecting to database:', err);
      (global as any).__checking_db = false;
    });
    
    // If we're checking the DB, wait for a bit to see if we get a result
    if ((global as any).__checking_db) {
      let attempts = 0;
      while ((global as any).__checking_db && attempts < 10) {
        // Simple way to wait synchronously
        const start = Date.now();
        while (Date.now() - start < 100) { /* wait */ }
        attempts++;
      }
      
      if ((global as any).__api_key) {
        return "db_key_found";
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error reading API key:', error);
    return null;
  }
}

// Extracts service name from URL
export function getServiceNameFromUrl(url: string): string | null {
  const parts = url.split('/');
  // The service name will typically be the first part of the URL path
  if (parts.length > 1) {
    return parts[1];
  }
  return null;
}

// Check if a service is running by making a request to its health endpoint
export async function isServiceRunning(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}
