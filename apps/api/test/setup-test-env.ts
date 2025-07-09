// Set up test environment variables before any imports
process.env.DATABASE_URL = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.JWT_EXPIRATION = '3600';
process.env.AUTH_JWT_SECRET = 'test-auth-secret-key-that-is-at-least-32-characters-long';
process.env.AUTH_JWT_EXPIRATION = '3600';
process.env.AUTH_JWT_AUD = 'test-audience';
process.env.AUTH_JWT_ISS = 'test-issuer';
process.env.SALT_ROUNDS = '10';
process.env.SMS_AT_API_KEY = 'test-sms-key';
process.env.SMS_AT_USERNAME = 'test-sms-user';
process.env.SMS_AT_FROM = 'test-from';
process.env.SMS_AT_KEYWORD = 'test-keyword';
process.env.PORT = '3000';

// Swap Service
process.env.SWAP_CLIENTD_BASE_URL = 'http://localhost:8080';
process.env.SWAP_CLIENTD_PASSWORD = 'test-password';
process.env.SWAP_FEDERATION_ID = 'test-federation';
process.env.SWAP_GATEWAY_ID = 'test-gateway';

// Solowallet Service
process.env.SOLOWALLET_CLIENTD_BASE_URL = 'http://localhost:8080';
process.env.SOLOWALLET_CLIENTD_PASSWORD = 'test-password';
process.env.SOLOWALLET_FEDERATION_ID = 'test-federation';
process.env.SOLOWALLET_GATEWAY_ID = 'test-gateway';
process.env.SOLOWALLET_LNURL_CALLBACK = 'http://localhost:3000/solowallet/lnurl';

// Chama Service
process.env.CHAMA_CLIENTD_BASE_URL = 'http://localhost:8080';
process.env.CHAMA_CLIENTD_PASSWORD = 'test-password';
process.env.CHAMA_FEDERATION_ID = 'test-federation';
process.env.CHAMA_GATEWAY_ID = 'test-gateway';
process.env.CHAMA_EXPERIENCE_URL = 'http://localhost:3000';
process.env.CHAMA_LNURL_CALLBACK = 'http://localhost:3000/chama/lnurl';
process.env.BITLY_TOKEN = 'test-bitly';

// Other services
process.env.INTASEND_PUBLIC_KEY = 'test-intasend-public';
process.env.INTASEND_PRIVATE_KEY = 'test-intasend-private';
process.env.NOSTR_PUBLIC_KEY = 'test-nostr-public';
process.env.NOSTR_PRIVATE_KEY = 'test-nostr-private';
process.env.NOSTR_RELAYS = 'wss://relay.damus.io,wss://relay.nostr.info';
