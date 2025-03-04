import { MongoClient } from 'mongodb';
import { Logger } from '@nestjs/common';
import { generateId, generateSpecifiedId, hashPin } from '../utils';

const FEATBIT_DB = 'featbit';
const logger = new Logger('FeatBitSeeder');

// Get the FeatBit MongoDB models
export const getFeatBitModels = async () => {
  // Use the same connection string format that the FeatBit services use in docker
  // Try to connect to the mongodb host as it would be seen from docker
  // If that fails, fall back to localhost
  let client;
  try {
    client = await MongoClient.connect('mongodb://bs:password@mongodb:27017');
    logger.log('Connected to MongoDB via docker network hostname');
  } catch (error) {
    logger.log('Failed to connect via docker network, trying localhost');
    client = await MongoClient.connect('mongodb://bs:password@localhost:27017');
    logger.log('Connected to MongoDB via localhost');
  }

  const db = client.db(FEATBIT_DB);

  return {
    client,
    db,
    Workspaces: db.collection('Workspaces'),
    Users: db.collection('Users'),
    Organizations: db.collection('Organizations'),
    OrganizationUsers: db.collection('OrganizationUsers'),
    Policies: db.collection('Policies'),
    MemberPolicies: db.collection('MemberPolicies'),
    Projects: db.collection('Projects'),
    Environments: db.collection('Environments'),
    AccessTokens: db.collection('AccessTokens'),
    FeatureFlags: db.collection('FeatureFlags'),
    AuditLogs: db.collection('AuditLogs'),
    EndUsers: db.collection('EndUsers'),
    ExperimentMetrics: db.collection('ExperimentMetrics'),
    Segments: db.collection('Segments'),
    RelayProxies: db.collection('RelayProxies'),
    Webhooks: db.collection('Webhooks'),
  };
};

// Function to clean all FeatBit collections
export const cleanFeatBitCollections = async (): Promise<void> => {
  logger.log('Clearing FeatBit collections...');
  const {
    client,
    db,
    Workspaces,
    Users,
    Organizations,
    OrganizationUsers,
    Policies,
    MemberPolicies,
    Projects,
    Environments,
    AccessTokens,
    FeatureFlags,
    AuditLogs,
    EndUsers,
    ExperimentMetrics,
    Segments,
    RelayProxies,
    Webhooks,
  } = await getFeatBitModels();

  try {
    // First clean individual collections
    await Workspaces.deleteMany({});
    logger.log('Cleared Workspaces collection');

    await Users.deleteMany({});
    logger.log('Cleared Users collection');

    await Organizations.deleteMany({});
    logger.log('Cleared Organizations collection');

    await OrganizationUsers.deleteMany({});
    logger.log('Cleared OrganizationUsers collection');

    await Policies.deleteMany({});
    logger.log('Cleared Policies collection');

    await MemberPolicies.deleteMany({});
    logger.log('Cleared MemberPolicies collection');

    await Projects.deleteMany({});
    logger.log('Cleared Projects collection');

    await Environments.deleteMany({});
    logger.log('Cleared Environments collection');

    await AccessTokens.deleteMany({});
    logger.log('Cleared AccessTokens collection');

    await FeatureFlags.deleteMany({});
    logger.log('Cleared FeatureFlags collection');

    await AuditLogs.deleteMany({});
    logger.log('Cleared AuditLogs collection');

    await EndUsers.deleteMany({});
    logger.log('Cleared EndUsers collection');

    await ExperimentMetrics.deleteMany({});
    logger.log('Cleared ExperimentMetrics collection');

    await Segments.deleteMany({});
    logger.log('Cleared Segments collection');

    await RelayProxies.deleteMany({});
    logger.log('Cleared RelayProxies collection');

    await Webhooks.deleteMany({});
    logger.log('Cleared Webhooks collection');

    // Drop the entire database
    await db.dropDatabase();
    logger.log(`Dropped entire ${FEATBIT_DB} database`);

    // Create the database again with minimal structure so FeatBit services can start
    await db.createCollection('_db_init');
    await db.collection('_db_init').insertOne({
      initialized: true,
      timestamp: new Date(),
    });
    logger.log(`Re-initialized ${FEATBIT_DB} database with basic structure`);

    logger.log('All FeatBit collections cleared');
  } catch (error) {
    logger.error('Error clearing FeatBit collections', error);
    throw error;
  } finally {
    // Make sure to wait a bit before closing the connection
    // to ensure all operations are complete
    await new Promise((resolve) => setTimeout(resolve, 500));
    await client.close();
    logger.log('Database connection closed');
  }
};

export const seedFeatBit = async (): Promise<void> => {
  console.log(`Use ${FEATBIT_DB} database`);

  const {
    client,
    db,
    Workspaces,
    Users,
    Organizations,
    OrganizationUsers,
    Policies,
    MemberPolicies,
    Projects,
    Environments,
    AccessTokens,
    FeatureFlags,
    AuditLogs,
    EndUsers,
    ExperimentMetrics,
    Segments,
    RelayProxies,
    Webhooks,
  } = await getFeatBitModels();

  console.log('Seed started...');

  try {
    // seed ids
    const workspaceId = generateId();
    const userId = generateId();
    const organizationId = generateId();
    const projectId = generateId();
    const environmentId = generateId();
    const accessTokenId = generateId();

    // built-in policies
    // see also: modules/back-end/src/Domain/Policies/BuiltInPolicy.cs
    const ownerPolicyId = generateSpecifiedId(
      '98881f6a-5c6c-4277-bcf7-fda94c538785',
    );
    const administratorPolicyId = generateSpecifiedId(
      '3e961f0f-6fd4-4cf4-910f-52d356f8cc08',
    );
    const developerPolicyId = generateSpecifiedId(
      '66f3687f-939d-4257-bd3f-c3553d39e1b6',
    );

    // seed workspace
    console.log('Seed collection: Workspaces');
    await Workspaces.insertOne({
      _id: workspaceId,
      name: 'Bitsacco Workspace',
      key: 'bitsacco-workspace',
      sso: null,
      license: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Collection seeded: Workspaces');

    // seed user
    console.log('Seed collection: Users');

    // Using a fixed password that FeatBit expects - default is 'Pass@word1'
    // FeatBit uses ASP.NET Core Identity's password hasher
    // This is a known working password hash for 'Pass@word1'
    const password =
      'AQAAAAEAACcQAAAAELDHEjCrDQrmnAXU5C//mOLvUBJ7lnVFEMMFxNMDIIrF7xK8JDQKUifU3HH4gexNAQ==';

    await Users.insertMany([
      {
        _id: userId,
        email: 'admin@bitsacco.com',
        password,
        name: 'Admin',
        origin: 'Local',
        workspaceId: workspaceId,
        createAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: generateId(), // Generate a different ID for the second user
        email: 'test@featbit.com',
        password,
        name: 'tester',
        origin: 'Local',
        workspaceId: workspaceId,
        createAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    console.log('Collection seeded: Users');

    // seed organization
    console.log('Seed collection: Organizations');
    await Organizations.insertOne({
      _id: organizationId,
      workspaceId: workspaceId,
      name: 'Bitsacco',
      key: 'bitsacco',
      initialized: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Collection seeded: Organizations');

    // seed organization users
    console.log('Seed collection: OrganizationUsers');
    await OrganizationUsers.insertOne({
      _id: generateId(),
      organizationId: organizationId,
      userId: userId,
      invitorId: null,
      initialPassword: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Collection seeded: OrganizationUsers');

    // seed system managed policies
    console.log('Seed collection: Policies');
    await Policies.insertOne({
      _id: ownerPolicyId,
      organizationId: null,
      name: 'Owner',
      description:
        'Contains all permissions. This policy is granted to the user who created the organization',
      type: 'SysManaged',
      statements: [
        {
          _id: generateId(),
          resourceType: '*',
          effect: 'allow',
          actions: ['*'],
          resources: ['*'],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await Policies.insertOne({
      _id: administratorPolicyId,
      organizationId: null,
      name: 'Administrator',
      description: 'Contains all the permissions required by an administrator',
      type: 'SysManaged',
      statements: [
        {
          _id: generateId(),
          resourceType: 'organization',
          effect: 'allow',
          actions: ['UpdateOrgName'],
          resources: ['organization/*'],
        },
        {
          _id: generateId(),
          resourceType: 'iam',
          effect: 'allow',
          actions: ['CanManageIAM'],
          resources: ['iam/*'],
        },
        {
          _id: generateId(),
          resourceType: 'access-token',
          effect: 'allow',
          actions: [
            'ManageServiceAccessTokens',
            'ManagePersonalAccessTokens',
            'ListAccessTokens',
          ],
          resources: ['access-token/*'],
        },
        {
          _id: generateId(),
          resourceType: 'relay-proxy',
          effect: 'allow',
          actions: ['ManageRelayProxies', 'ListRelayProxies'],
          resources: ['relay-proxy/*'],
        },
        {
          _id: generateId(),
          resourceType: 'project',
          effect: 'allow',
          actions: [
            'CanAccessProject',
            'CreateProject',
            'DeleteProject',
            'UpdateProjectSettings',
            'CreateEnv',
          ],
          resources: ['project/*'],
        },
        {
          _id: generateId(),
          resourceType: 'env',
          effect: 'allow',
          actions: [
            'DeleteEnv',
            'UpdateEnvSettings',
            'CreateEnvSecret',
            'DeleteEnvSecret',
            'UpdateEnvSecret',
          ],
          resources: ['project/*:env/*'],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await Policies.insertOne({
      _id: developerPolicyId,
      organizationId: null,
      name: 'Developer',
      description: 'Contains all the permissions required by a developer',
      type: 'SysManaged',
      statements: [
        {
          _id: generateId(),
          resourceType: 'access-token',
          effect: 'allow',
          actions: [
            'ManageServiceAccessTokens',
            'ManagePersonalAccessTokens',
            'ListAccessTokens',
          ],
          resources: ['access-token/*'],
        },
        {
          _id: generateId(),
          resourceType: 'relay-proxy',
          effect: 'allow',
          actions: ['ManageRelayProxies', 'ListRelayProxies'],
          resources: ['relay-proxy/*'],
        },
        {
          _id: generateId(),
          resourceType: 'project',
          effect: 'allow',
          actions: ['CanAccessProject'],
          resources: ['project/*'],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Collection seeded: Policies');

    // seed member policy
    console.log('Seed collection: MemberPolicies');
    await MemberPolicies.insertOne({
      _id: generateId(),
      organizationId: organizationId,
      policyId: ownerPolicyId,
      memberId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Collection seeded: MemberPolicies');

    // seed project
    console.log('Seed collection: Projects');
    await Projects.insertOne({
      _id: projectId,
      organizationId: organizationId,
      name: 'Bitsacco OS',
      key: 'bitsacco-os',
      description: 'Feature flags for Bitsacco OS',
      tags: ['bitcoin', 'microservices'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Collection seeded: Projects');

    // seed environment
    console.log('Seed collection: Environments');
    await Environments.insertOne({
      _id: environmentId,
      projectId: projectId,
      organizationId: organizationId,
      name: 'Development',
      key: 'development',
      description: 'Development environment',
      secrets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Collection seeded: Environments');

    // seed access token
    console.log('Seed collection: AccessTokens');
    await AccessTokens.insertOne({
      _id: accessTokenId,
      name: 'Bitsacco Server Token',
      type: 'Service',
      createdBy: userId,
      organizationId: organizationId,
      projectId: projectId,
      environmentId: environmentId,
      key: `sv-${generateId()}`,
      description: 'Server-side SDK token for Bitsacco services',
      expireAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Collection seeded: AccessTokens');

    // seed feature flags
    console.log('Seed collection: FeatureFlags');

    // Examples of feature flags for Bitsacco services
    const featureFlags = [
      {
        _id: generateId(),
        name: 'Enable LNURL Withdrawal',
        key: 'enable-lnurl-withdrawal',
        description: 'Enable LNURL withdrawal functionality',
        variationType: 'Boolean',
        permanent: false,
        archived: false,
        environmentId: environmentId,
        projectId: projectId,
        organizationId: organizationId,
        targetUsers: 'All users',
        disabledVariationId: generateId(),
        enabledVariationId: generateId(),
        variations: [
          {
            id: generateId(),
            value: 'false',
            name: 'Disabled',
            description: 'Withdrawal functionality is disabled',
          },
          {
            id: generateId(),
            value: 'true',
            name: 'Enabled',
            description: 'Withdrawal functionality is enabled',
          },
        ],
        rules: [],
        defaultRule: {
          variationId: generateId(),
          dispatchKey: null,
          variationValue: 'true',
          includedInExpt: false,
        },
        isExptEnabled: false,
        evaluationSummary: {
          timestamp: new Date(),
          data: {},
        },
        lastModifierName: 'Admin',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: generateId(),
        name: 'Fedimint Federation',
        key: 'fedimint-federation',
        description: 'Control which Fedimint federation to connect to',
        variationType: 'String',
        permanent: false,
        archived: false,
        environmentId: environmentId,
        projectId: projectId,
        organizationId: organizationId,
        targetUsers: 'All users',
        disabledVariationId: generateId(),
        enabledVariationId: generateId(),
        variations: [
          {
            id: generateId(),
            value:
              'fed11qgqrsdnhwden5te0dp6k6mtfdenj6mr0v3nk2tfk09jkkeekxechqmphdvm8wdttxauxvufwwahx27r59eshqup0waej7qqpyq8kqe90ktshlvw3f88ztywxz559ag0yjvljvvtd3kepx2sfg2qdjn7s5m0',
            name: 'Default Federation',
            description: 'Default Fedimint federation',
          },
          {
            id: generateId(),
            value:
              'fed11qgqrwdthwden5te0v9cxjttndakk2ttrdpjk2um994erx7rsx568vur9dy68z6pnvd6xg63hwsh8wmn90p6zuctswqhsqqfqt94ttf29vdm0jfw3gk3w7quvcknshxd705ksavc0ajj7sj0v6dgsxcydnc',
            name: 'Alternative Federation',
            description: 'Alternative Fedimint federation',
          },
        ],
        rules: [],
        defaultRule: {
          variationId: generateId(),
          dispatchKey: null,
          variationValue:
            'fed11qgqrsdnhwden5te0dp6k6mtfdenj6mr0v3nk2tfk09jkkeekxechqmphdvm8wdttxauxvufwwahx27r59eshqup0waej7qqpyq8kqe90ktshlvw3f88ztywxz559ag0yjvljvvtd3kepx2sfg2qdjn7s5m0',
          includedInExpt: false,
        },
        isExptEnabled: false,
        evaluationSummary: {
          timestamp: new Date(),
          data: {},
        },
        lastModifierName: 'Admin',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: generateId(),
        name: 'IntaSend Payment Method',
        key: 'intasend-payment-method',
        description: 'Enable IntaSend payment method for swap service',
        variationType: 'Boolean',
        permanent: false,
        archived: false,
        environmentId: environmentId,
        projectId: projectId,
        organizationId: organizationId,
        targetUsers: 'All users',
        disabledVariationId: generateId(),
        enabledVariationId: generateId(),
        variations: [
          {
            id: generateId(),
            value: 'false',
            name: 'Disabled',
            description: 'IntaSend payment method is disabled',
          },
          {
            id: generateId(),
            value: 'true',
            name: 'Enabled',
            description: 'IntaSend payment method is enabled',
          },
        ],
        rules: [],
        defaultRule: {
          variationId: generateId(),
          dispatchKey: null,
          variationValue: 'true',
          includedInExpt: false,
        },
        isExptEnabled: false,
        evaluationSummary: {
          timestamp: new Date(),
          data: {},
        },
        lastModifierName: 'Admin',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const flag of featureFlags) {
      await FeatureFlags.insertOne(flag);
    }
    console.log('Collection seeded: FeatureFlags');

    // add indexes
    console.log('Add indexes...');
    await AuditLogs.createIndex({ createdAt: 1 });
    await EndUsers.createIndex({ updatedAt: 1 });
    await ExperimentMetrics.createIndex({ updatedAt: 1 });
    await FeatureFlags.createIndex({ updatedAt: 1 });
    await Segments.createIndex({ updatedAt: 1 });
    await AccessTokens.createIndex({ createdAt: 1 });
    await Policies.createIndex({ createdAt: 1 });
    await Projects.createIndex({ createdAt: 1 });
    await RelayProxies.createIndex({ createdAt: 1 });
    await Webhooks.createIndex({ createdAt: 1 });
    await Webhooks.createIndex({ startedAt: 1 });
    console.log('Indexes added');

    console.log('FeatBit seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding FeatBit:', error);
    throw error;
  } finally {
    await client.close();
  }
};
