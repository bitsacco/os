/**
 * FeatBit User Sync Service
 * 
 * This service uses MongoDB Change Streams to monitor the Bitsacco users collection
 * and synchronize changes with the FeatBit users collection.
 */

import { MongoClient } from 'mongodb';
import { Logger } from '@nestjs/common';
import { 
  getFeatBitModels, 
  connectToBitsaccoDb, 
  transformUserToFeatBit 
} from './index';

const logger = new Logger('FeatBitSyncService');

/**
 * Main function to start the sync service
 */
export const startFeatBitSync = async (): Promise<void> => {
  logger.log('Starting FeatBit user sync service...');

  // Get connections to both databases
  const { client: bitsaccoClient, db: bitsaccoDb } = await connectToBitsaccoDb();
  const { client: featBitClient, Users: featBitUsers, Workspaces } = await getFeatBitModels();

  try {
    // Get or create a workspace for Bitsacco users
    const workspaces = await Workspaces.find({}).toArray();
    const workspaceId = workspaces.length > 0 
      ? workspaces[0]._id 
      : await createDefaultWorkspace(Workspaces);

    logger.log(`Using workspace ID: ${workspaceId}`);

    // Set up change stream on Bitsacco users collection
    const usersCollection = bitsaccoDb.collection('users');
    
    // Perform initial sync before watching for changes
    await performFullSync(usersCollection, featBitUsers, workspaceId);

    // Watch for changes using MongoDB Change Streams
    const changeStream = usersCollection.watch([], { fullDocument: 'updateLookup' });
    
    changeStream.on('change', async (change) => {
      try {
        switch (change.operationType) {
          case 'insert':
          case 'update':
          case 'replace':
            await handleUserUpsert(change.fullDocument, featBitUsers, workspaceId);
            break;
          
          case 'delete':
            await handleUserDelete(change.documentKey._id, featBitUsers);
            break;
            
          default:
            logger.log(`Unhandled operation type: ${change.operationType}`);
        }
      } catch (error) {
        logger.error(`Error handling change event: ${error.message}`, error.stack);
      }
    });

    logger.log('FeatBit user sync service started successfully');
    
    // Keep the service running
    process.on('SIGINT', async () => {
      logger.log('Stopping FeatBit user sync service...');
      await closeConnections(bitsaccoClient, featBitClient, changeStream);
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.log('Stopping FeatBit user sync service...');
      await closeConnections(bitsaccoClient, featBitClient, changeStream);
      process.exit(0);
    });

  } catch (error) {
    logger.error(`Error in FeatBit sync service: ${error.message}`, error.stack);
    await closeConnections(bitsaccoClient, featBitClient);
    process.exit(1);
  }
};

/**
 * Create a default workspace if none exists
 */
async function createDefaultWorkspace(Workspaces) {
  const workspaceId = new MongoClient.ObjectId().toString();
  await Workspaces.insertOne({
    _id: workspaceId,
    name: 'Bitsacco Workspace',
    key: 'bitsacco-workspace',
    sso: null,
    license: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  logger.log('Created new workspace for FeatBit users');
  return workspaceId;
}

/**
 * Perform full synchronization of all users
 */
async function performFullSync(bitsaccoUsers, featBitUsers, workspaceId) {
  logger.log('Starting full user synchronization...');
  
  const users = await bitsaccoUsers.find({}).toArray();
  logger.log(`Found ${users.length} users to synchronize`);
  
  for (const user of users) {
    await handleUserUpsert(user, featBitUsers, workspaceId);
  }
  
  logger.log('Full user synchronization completed');
}

/**
 * Handle user insert or update
 */
async function handleUserUpsert(bitsaccoUser, featBitUsers, workspaceId) {
  try {
    const userId = bitsaccoUser._id.toString();
    logger.log(`Processing user ${userId}`);
    
    // Transform Bitsacco user to FeatBit user
    const featBitUser = transformUserToFeatBit(bitsaccoUser, workspaceId);
    
    // Check if user already exists in FeatBit
    const existingUser = await featBitUsers.findOne({ _id: userId });
    
    if (existingUser) {
      // Update existing user
      await featBitUsers.updateOne(
        { _id: userId },
        { 
          $set: {
            email: featBitUser.email,
            name: featBitUser.name,
            admin: featBitUser.admin,
            updatedAt: new Date()
          } 
        }
      );
      logger.log(`Updated user ${userId} in FeatBit`);
    } else {
      // Insert new user
      await featBitUsers.insertOne(featBitUser);
      logger.log(`Added new user ${userId} to FeatBit`);
    }
  } catch (error) {
    logger.error(`Error handling user upsert: ${error.message}`, error.stack);
  }
}

/**
 * Handle user deletion
 */
async function handleUserDelete(documentKey, featBitUsers) {
  try {
    const userId = documentKey._id.toString();
    
    // Option 1: Hard delete the user from FeatBit
    // await featBitUsers.deleteOne({ _id: userId });
    
    // Option 2: Mark the user as deleted but keep the record (safer)
    await featBitUsers.updateOne(
      { _id: userId },
      { 
        $set: {
          deleted: true,
          deletedAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    
    logger.log(`Marked user ${userId} as deleted in FeatBit`);
  } catch (error) {
    logger.error(`Error handling user delete: ${error.message}`, error.stack);
  }
}

/**
 * Close database connections and change stream
 */
async function closeConnections(bitsaccoClient, featBitClient, changeStream = null) {
  try {
    if (changeStream) {
      await changeStream.close();
      logger.log('Change stream closed');
    }
    
    if (bitsaccoClient) {
      await bitsaccoClient.close();
      logger.log('Bitsacco database connection closed');
    }
    
    if (featBitClient) {
      await featBitClient.close();
      logger.log('FeatBit database connection closed');
    }
  } catch (error) {
    logger.error(`Error closing connections: ${error.message}`);
  }
}

// If this file is executed directly
if (require.main === module) {
  startFeatBitSync()
    .catch(err => {
      logger.error(`Failed to start sync service: ${err.message}`, err.stack);
      process.exit(1);
    });
}