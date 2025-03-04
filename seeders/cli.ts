#!/usr/bin/env node

import { Command } from 'commander';
import { seed, clean } from './bitsacco';
import { cleanFeatBitCollections, seedFeatBit } from './featbit';
import { startFeatBitSync } from './featbit/sync';

// Create CLI program
const program = new Command();

program
  .name('bs-seeder')
  .description(
    'CLI to seed and clean app and feature databases for Bitsacco OS',
  )
  .version('1.0.0');

// Bitsacco Seed command
program
  .command('bitsacco:seed')
  .description('Seed Bitsacco database with test data')
  .action(async () => {
    try {
      await seed();
      process.exit(0);
    } catch (error) {
      console.error('Error seeding database:', error);
      process.exit(1);
    }
  });

// Bitsacco Clean command
program
  .command('bitsacco:clean')
  .description('Clean seeded data from database')
  .action(async () => {
    try {
      await clean();
      process.exit(0);
    } catch (error) {
      console.error('Error cleaning database:', error);
      process.exit(1);
    }
  });

// FeatBit seed command
program
  .command('featbit:seed')
  .description('Seed FeatBit feature flag database')
  .action(async () => {
    try {
      console.log('Starting FeatBit seed operation...');
      await seedFeatBit();
      console.log('FeatBit seed operation completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('Error seeding FeatBit database:', error);
      process.exit(1);
    }
  });

// FeatBit clean command
program
  .command('featbit:clean')
  .description('Clean FeatBit feature flag database')
  .action(async () => {
    try {
      await cleanFeatBitCollections();
      process.exit(0);
    } catch (error) {
      console.error('Error cleaning FeatBit database:', error);
      process.exit(1);
    }
  });

// Common seed command
program
  .command('seed')
  .description('Seed Bitsacco and FeatBit databases')
  .action(async () => {
    try {
      await seed();
      await seedFeatBit();
      process.exit(0);
    } catch (error) {
      console.error('Error seeding database:', error);
      process.exit(1);
    }
  });

// Common clean command
program
  .command('clean')
  .description('Clean Bitsacco and FeatBit databases')
  .action(async () => {
    try {
      await clean();
      await cleanFeatBitCollections();
      process.exit(0);
    } catch (error) {
      console.error('Error cleaning databases', error);
      process.exit(1);
    }
  });

// Start FeatBit sync service command
program
  .command('featbit:sync')
  .description('Start FeatBit user synchronization service')
  .action(async () => {
    try {
      console.log('Starting FeatBit user synchronization service...');
      await startFeatBitSync();
      // Note: This will not exit unless there's an error or the service is stopped
    } catch (error) {
      console.error('Error starting FeatBit sync service:', error);
      process.exit(1);
    }
  });

// Execute
program.parse(process.argv);
