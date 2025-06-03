// MongoDB initialization script for Docker
db = db.getSiblingDB('bitsacco');

// Create application user
db.createUser({
  user: 'bitsacco-app',
  pwd: 'app-password',
  roles: [
    {
      role: 'readWrite',
      db: 'bitsacco',
    },
  ],
});

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['phone', 'createdAt'],
      properties: {
        phone: {
          bsonType: 'string',
          pattern: '^\\+[1-9]\\d{1,14}$',
        },
        email: {
          bsonType: ['string', 'null'],
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        },
        role: {
          bsonType: 'string',
          enum: ['user', 'admin', 'superadmin'],
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'inactive', 'suspended'],
        },
      },
    },
  },
});

db.createCollection('tokens', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'token', 'type', 'expiresAt'],
      properties: {
        type: {
          bsonType: 'string',
          enum: ['refresh', 'access', 'reset', 'verify'],
        },
      },
    },
  },
});

db.createCollection('apikeys', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['keyId', 'hashedKey', 'service', 'createdAt'],
      properties: {
        service: {
          bsonType: 'string',
        },
        isActive: {
          bsonType: 'bool',
        },
      },
    },
  },
});

// Create indexes for performance
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ npub: 1 }, { unique: true, sparse: true });
db.users.createIndex({ createdAt: 1 });

db.tokens.createIndex({ userId: 1 });
db.tokens.createIndex({ token: 1 }, { unique: true });
db.tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.apikeys.createIndex({ keyId: 1 }, { unique: true });
db.apikeys.createIndex({ service: 1 });
db.apikeys.createIndex({ isActive: 1 });

// Collections for other domains
db.createCollection('chamas');
db.createCollection('chamawallet');
db.createCollection('shares');
db.createCollection('shares_offers');
db.createCollection('solowallet');
db.createCollection('notifications');
db.createCollection('notification_preferences');

// Create indexes for domain collections
db.chamas.createIndex({ ownerId: 1 });
db.chamas.createIndex({ members: 1 });
db.chamas.createIndex({ createdAt: 1 });

db.shares.createIndex({ userId: 1 });
db.shares.createIndex({ symbol: 1 });
db.shares.createIndex({ createdAt: 1 });

db.notifications.createIndex({ userId: 1 });
db.notifications.createIndex({ type: 1 });
db.notifications.createIndex({ createdAt: 1 });
db.notifications.createIndex({ sentAt: 1 });

print('Database initialized successfully');
