import { MongoMemoryServer } from 'mongodb-memory-server';
import { RedisMemoryServer } from 'redis-memory-server';

let mongod: MongoMemoryServer;
let redisServer: RedisMemoryServer;

export default async function globalSetup() {
  // Start in-memory MongoDB for tests
  mongod = await MongoMemoryServer.create({
    binary: {
      version: '7.0.0',
    },
    instance: {
      dbName: 'bitsacco_test',
    },
  });

  const mongoUri = mongod.getUri();
  process.env.MONGODB_URI = mongoUri;

  // Start in-memory Redis for tests
  redisServer = new RedisMemoryServer({
    instance: {
      port: 6380, // Use different port for tests
    },
  });

  const redisHost = await redisServer.getHost();
  const redisPort = await redisServer.getPort();
  process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`;

  // Store references for cleanup
  (global as any).__MONGOD__ = mongod;
  (global as any).__REDIS__ = redisServer;

  console.log('🚀 Test environment setup complete');
  console.log(`📁 MongoDB Test URI: ${mongoUri}`);
  console.log(`📁 Redis Test URI: redis://${redisHost}:${redisPort}`);
}
