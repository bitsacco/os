export default async function globalTeardown() {
  // Clean up MongoDB
  const mongod = (global as any).__MONGOD__;
  if (mongod) {
    await mongod.stop();
  }

  // Clean up Redis
  const redisServer = (global as any).__REDIS__;
  if (redisServer) {
    await redisServer.stop();
  }

  console.log('🧹 Test environment cleanup complete');
}
