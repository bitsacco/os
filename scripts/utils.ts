import * as fs from 'fs';
import * as path from 'path';

// Read the global API key from environment files
export function readGlobalApiKey(): string | null {
  try {
    // Check if .dev.env exists in root
    const envPath = path.join(__dirname, '..', '.dev.env');
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
      const serviceEnvPath = path.join(__dirname, '..', 'apps', service, '.dev.env');
      if (fs.existsSync(serviceEnvPath)) {
        const envContent = fs.readFileSync(serviceEnvPath, 'utf-8');
        const match = envContent.match(/GLOBAL_API_KEY=([^\s]+)/);
        if (match && match[1]) {
          return match[1];
        }
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