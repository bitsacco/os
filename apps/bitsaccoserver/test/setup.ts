import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(__dirname, '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log in tests unless VERBOSE_TESTS is set
  log: process.env.VERBOSE_TESTS ? console.log : jest.fn(),
  debug: process.env.VERBOSE_TESTS ? console.debug : jest.fn(),
  info: process.env.VERBOSE_TESTS ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock external services by default
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    flushall: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
  })),
}));

// Mock MongoDB by default (will be overridden in integration tests)
jest.mock('mongoose', () => ({
  connect: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(() => Promise.resolve()),
  connection: {
    readyState: 1,
    on: jest.fn(),
    once: jest.fn(),
    db: {
      startSession: jest.fn(() => ({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
        withTransaction: jest.fn((fn) => fn()),
      })),
    },
  },
  startSession: jest.fn(() => ({
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
    withTransaction: jest.fn((fn) => fn()),
  })),
}));

// Mock gRPC client
jest.mock('@grpc/grpc-js', () => ({
  credentials: {
    createInsecure: jest.fn(),
  },
  loadPackageDefinition: jest.fn(),
}));

// Mock Africa's Talking
jest.mock('africastalking', () => {
  return jest.fn(() => ({
    SMS: {
      send: jest.fn(() =>
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
});

// Mock Nostr
jest.mock('nostr-tools', () => ({
  SimplePool: jest.fn(() => ({
    publish: jest.fn(() => Promise.resolve()),
    close: jest.fn(),
  })),
  getEventHash: jest.fn(() => 'test-event-hash'),
  signEvent: jest.fn(() => ({ sig: 'test-signature' })),
  generatePrivateKey: jest.fn(() => 'test-private-key'),
  getPublicKey: jest.fn(() => 'test-public-key'),
}));

// Suppress OpenTelemetry warnings in tests
process.env.OTEL_SDK_DISABLED = 'true';
