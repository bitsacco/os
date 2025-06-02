import { config } from 'dotenv';
import { join } from 'path';
import { mock } from 'bun:test';

// Load test environment variables
config({ path: join(__dirname, '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log in tests unless VERBOSE_TESTS is set
  log: process.env.VERBOSE_TESTS ? console.log : mock(),
  debug: process.env.VERBOSE_TESTS ? console.debug : mock(),
  info: process.env.VERBOSE_TESTS ? console.info : mock(),
  warn: console.warn,
  error: console.error,
};

// Note: Bun's module mocking is done in test files themselves
// This setup file provides global configuration

// Mock Redis client factory
global.mockRedisClient = {
  connect: mock(),
  disconnect: mock(),
  set: mock(),
  get: mock(),
  del: mock(),
  exists: mock(),
  expire: mock(),
  flushall: mock(),
  on: mock(),
  quit: mock(),
};

// Mock MongoDB connection
global.mockMongoose = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  connection: {
    readyState: 1,
    on: mock(),
    once: mock(),
    db: {
      startSession: mock(() => ({
        startTransaction: mock(),
        commitTransaction: mock(),
        abortTransaction: mock(),
        endSession: mock(),
        withTransaction: mock((fn) => fn()),
      })),
    },
  },
  startSession: mock(() => ({
    startTransaction: mock(),
    commitTransaction: mock(),
    abortTransaction: mock(),
    endSession: mock(),
    withTransaction: mock((fn) => fn()),
  })),
};

// Mock gRPC client
global.mockGrpc = {
  credentials: {
    createInsecure: mock(),
  },
  loadPackageDefinition: mock(),
};

// Mock Africa's Talking
global.mockAfricasTalking = mock(() => ({
  SMS: {
    send: mock(() =>
      Promise.resolve({
        SMSMessageData: {
          Message: 'Sent to 1/1 Total Cost: KES 0.8000',
          Recipients: [
            {
              statusCode: 101,
              number: '+254700000000',
              status: 'Success',
              cost: 'KES 0.8000',
              messageId: 'test-message-id',
            },
          ],
        },
      }),
    ),
  },
}));

// Mock Nostr
global.mockNostr = {
  SimplePool: mock(() => ({
    publish: mock(() => Promise.resolve()),
    close: mock(),
  })),
  getEventHash: mock(() => 'test-event-hash'),
  signEvent: mock(() => ({ sig: 'test-signature' })),
  generatePrivateKey: mock(() => 'test-private-key'),
  getPublicKey: mock(() => 'test-public-key'),
};

// Suppress OpenTelemetry warnings in tests
process.env.OTEL_SDK_DISABLED = 'true';
