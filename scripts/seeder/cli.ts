#!/usr/bin/env node

import { Command } from 'commander';
import { seed, clean } from './index';
import { isMongoDbAvailable } from '../utils/db';

// Create CLI program
const program = new Command();

program
  .name('bitsacco-seeder')
  .description('CLI to seed and clean database for Bitsacco OS')
  .version('1.0.0');

// Function to check database availability
async function checkDbAndExecute(operation: () => Promise<void>) {
  // Check if help was requested
  if (process.argv.includes('--help')) {
    return;
  }
  
  // Check if MongoDB server is available
  const dbAvailable = await isMongoDbAvailable();
  if (!dbAvailable) {
    console.error('\n🛑 MongoDB server is not available!');
    console.error('Make sure MongoDB is running on localhost:27017 or use docker-compose.');
    console.error('\nYou can start MongoDB using:');
    console.error('  - Docker: docker compose -p os up');
    console.error('  - Local MongoDB: mongod --dbpath=/path/to/data');
    process.exit(1);
    return;
  }
  
  await operation();
}

// Seed command
program
  .command('seed')
  .description('Seed database with test data')
  .action(async () => {
    try {
      await checkDbAndExecute(seed);
      process.exit(0);
    } catch (error) {
      if (error.name === 'ValidationError') {
        console.error('\n🛑 MongoDB validation error:');
        console.error(error.message);
        console.error('\nThis is likely due to a schema mismatch. You may need to update the seeder code.');
      } else {
        console.error('Error seeding database:', error.message || error);
      }
      process.exit(1);
    }
  });

// Clean command
program
  .command('clean')
  .description('Clean seeded data from database')
  .action(async () => {
    try {
      await checkDbAndExecute(clean);
      process.exit(0);
    } catch (error) {
      if (error.name === 'ValidationError') {
        console.error('\n🛑 MongoDB validation error:');
        console.error(error.message);
        console.error('\nThis is likely due to a schema mismatch. You may need to update the seeder code.');
      } else {
        console.error('Error cleaning database:', error.message || error);
      }
      process.exit(1);
    }
  });

// Execute
program.parse(process.argv);
