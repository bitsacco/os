import {
  connectMongoose,
  closeMongooseConnection,
  registerSeederSchemas,
  getSeederModels,
  clearSeederCollections,
} from '../utils/db';

// Re-export the functions from the shared database utility
export const connectToDatabase = connectMongoose;
export const closeDatabaseConnection = closeMongooseConnection;
export const registerSchemas = registerSeederSchemas;
export const getModels = getSeederModels;
export const clearCollections = clearSeederCollections;
