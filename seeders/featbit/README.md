# FeatBit User Synchronization

This directory contains tools to integrate Bitsacco OS users with FeatBit feature flag management system.

## Overview

Instead of maintaining separate user databases for Bitsacco and FeatBit, this implementation:
1. Uses MongoDB Change Streams to monitor the Bitsacco users collection
2. Automatically synchronizes user changes to the FeatBit users collection
3. Maintains user identity alignment between both systems

## Components

### 1. Data Transformation Logic

The `index.ts` file contains:
- Functions to connect to Bitsacco and FeatBit databases
- Logic to transform Bitsacco users into FeatBit-compatible format
- Initial seeding functionality that populates FeatBit with existing Bitsacco users

### 2. Real-time Sync Service

The `sync.ts` file contains:
- A service that watches for changes in Bitsacco users using MongoDB Change Streams
- Handlers for user creation, updates, and deletion events
- An initial full sync to ensure data consistency on service startup

## Running the Sync Service

### Development Environment

```bash
# Run from project root
bun seeders/cli.ts featbit:sync
```

### Production Environment

The service is automatically deployed as a Docker container in the main compose.yml file. The container:
1. Starts when the Bitsacco stack is deployed
2. Connects to the shared MongoDB instance
3. Continuously monitors for user changes

## User Data Mapping

Bitsacco users are mapped to FeatBit users with the following logic:
- User IDs are preserved to maintain direct correlation
- Emails are generated from phone numbers or nostr npubs
- Admin status is derived from Bitsacco user roles
- A `bitsaccoUser: true` flag identifies synchronized users

## Troubleshooting

If users aren't synchronized properly:

1. Check MongoDB logs for connection issues
2. Verify that MongoDB Change Streams are enabled (requires a replica set in production)
3. Review the featbit-sync service logs for specific error messages
4. Run a manual resynchronization with `bun seeders/cli.ts featbit:seed`

## Production Configuration

For production environments:
- Ensure MongoDB is running as a replica set to support Change Streams
- Consider adding authentication to MongoDB connections
- Update connection strings in environment variables
- Implement monitoring for the sync service