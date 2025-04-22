import axios from 'axios';
import { readGlobalApiKey } from './utils';

// Test API key authentication with the API gateway
async function testApiKeyAuth() {
  console.log('Testing API key authentication with the API gateway...');
  
  const globalApiKey = readGlobalApiKey();
  if (!globalApiKey) {
    console.error('No global API key found. Please run the generate-global-apikey.ts script first.');
    return;
  }
  
  console.log(`Found API key: ${globalApiKey.substring(0, 16)}...`);
  
  try {
    // Test the API gateway health endpoint with API key
    console.log('Testing API gateway health endpoint with API key...');
    const response = await axios.get('http://localhost:4000/health', {
      headers: {
        'x-api-key': globalApiKey,
      },
    });
    
    console.log(`API Gateway Health Check Status: ${response.status}`);
    console.log(`API Gateway Health Check Response:`, response.data);
    console.log('🎉 API key authentication successful!');
  } catch (error) {
    console.error('API key authentication failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testApiKeyAuth().catch(console.error);