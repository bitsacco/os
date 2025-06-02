import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { TestDatabase } from './test-database';

export interface TestModuleConfig {
  imports?: any[];
  providers?: any[];
  controllers?: any[];
  exports?: any[];
}

export class TestModuleBuilder {
  private config: TestModuleConfig = {
    imports: [],
    providers: [],
    controllers: [],
    exports: [],
  };

  static create(): TestModuleBuilder {
    return new TestModuleBuilder();
  }

  withDatabase(): TestModuleBuilder {
    this.config.imports!.push(TestDatabase.forRoot());
    return this;
  }

  withConfig(): TestModuleBuilder {
    this.config.imports!.push(
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ['test/.env.test'],
        expandVariables: true,
      }),
    );
    return this;
  }

  withEventEmitter(): TestModuleBuilder {
    this.config.imports!.push(
      EventEmitterModule.forRoot({
        wildcard: true,
        delimiter: '.',
        newListener: false,
        removeListener: false,
        maxListeners: 20,
        verboseMemoryLeak: false,
        ignoreErrors: false,
      }),
    );
    return this;
  }

  withImports(imports: any[]): TestModuleBuilder {
    this.config.imports!.push(...imports);
    return this;
  }

  withProviders(providers: any[]): TestModuleBuilder {
    this.config.providers!.push(...providers);
    return this;
  }

  withControllers(controllers: any[]): TestModuleBuilder {
    this.config.controllers!.push(...controllers);
    return this;
  }

  withMockDatabase(): TestModuleBuilder {
    const mockConnection = TestDatabase.createMockConnection();
    this.config.providers!.push({
      provide: getConnectionToken(),
      useValue: mockConnection,
    });
    return this;
  }

  async compile(): Promise<TestingModule> {
    const moduleRef = await Test.createTestingModule(this.config).compile();
    return moduleRef;
  }

  async compileAndInit(): Promise<TestingModule> {
    const moduleRef = await this.compile();
    await moduleRef.init();
    return moduleRef;
  }
}

export class TestApp {
  private module: TestingModule;

  constructor(module: TestingModule) {
    this.module = module;
  }

  static async create(config?: TestModuleConfig): Promise<TestApp> {
    const builder = TestModuleBuilder.create().withConfig().withEventEmitter();

    if (config) {
      if (config.imports) builder.withImports(config.imports);
      if (config.providers) builder.withProviders(config.providers);
      if (config.controllers) builder.withControllers(config.controllers);
    }

    const module = await builder.compileAndInit();
    return new TestApp(module);
  }

  get<T>(typeOrToken: any): T {
    return this.module.get<T>(typeOrToken);
  }

  async clearDatabase(): Promise<void> {
    try {
      const connection = this.module.get<mongoose.Connection>(getConnectionToken());
      await TestDatabase.clearDatabase(connection);
    } catch (error) {
      // Database not available in this test module
    }
  }

  async seedDatabase(seedData: any): Promise<void> {
    try {
      const connection = this.module.get<mongoose.Connection>(getConnectionToken());
      await TestDatabase.seedDatabase(connection, seedData);
    } catch (error) {
      // Database not available in this test module
    }
  }

  async close(): Promise<void> {
    await this.module.close();
  }
}

// Common test data factory
export class TestDataFactory {
  static createUser(overrides: any = {}) {
    return {
      _id: 'test-user-id',
      phone: '+254700000000',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      status: 'active',
      isPhoneVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createChama(overrides: any = {}) {
    return {
      _id: 'test-chama-id',
      name: 'Test Chama',
      description: 'A test chama',
      ownerId: 'test-user-id',
      members: [
        {
          userId: 'test-user-id',
          role: 'owner',
          joinedAt: new Date(),
          status: 'active',
        },
      ],
      targetAmount: 100000,
      currency: 'KES',
      memberLimit: 10,
      contributionFrequency: 'monthly',
      contributionAmount: 5000,
      status: 'active',
      currentAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createWallet(overrides: any = {}) {
    return {
      _id: 'test-wallet-id',
      userId: 'test-user-id',
      type: 'solo',
      balance: 0,
      currency: 'BTC',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createToken(overrides: any = {}) {
    return {
      _id: 'test-token-id',
      userId: 'test-user-id',
      token: 'test-refresh-token',
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      ...overrides,
    };
  }

  static createApiKey(overrides: any = {}) {
    return {
      _id: 'test-apikey-id',
      keyId: 'test-key-id',
      hashedKey: 'hashed-key-value',
      service: 'test-service',
      isActive: true,
      createdAt: new Date(),
      ...overrides,
    };
  }
}
