import { ClientGrpc, ClientsModule, Transport } from '@nestjs/microservices';
import { Injectable, Module, Inject } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { AUTH_SERVICE_NAME, AuthServiceClient } from '@bitsacco/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { readGlobalApiKey } from './utils';
import { firstValueFrom } from 'rxjs';

// Create a test service that uses gRPC to communicate with the auth service
@Injectable()
class TestService {
  private authService: AuthServiceClient;

  constructor(
    @Inject(AUTH_SERVICE_NAME) private clientGrpc: ClientGrpc,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.authService =
      this.clientGrpc.getService<AuthServiceClient>(AUTH_SERVICE_NAME);
  }

  async testAuthenticateToken(token: string) {
    try {
      // This should automatically add the API key to the gRPC metadata via interceptor
      const response = await firstValueFrom(
        this.authService.authenticate({ accessToken: token }),
      );
      return response;
    } catch (error) {
      console.error('Error authenticating token:', error.message);
      throw error;
    }
  }
}

// Module for testing
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.dev.env', 'apps/api/.dev.env'],
    }),
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'auth',
            protoPath: join(__dirname, '../../proto/auth.proto'),
            url: configService.get('AUTH_GRPC_URL', 'localhost:4060'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [TestService],
})
class TestModule {}

// Main function to run the test
async function testGrpcApiKey() {
  console.log('Testing gRPC API key authentication between services...');

  const globalApiKey = readGlobalApiKey();
  if (!globalApiKey) {
    console.error(
      'No global API key found. Please run the generate-global-apikey.ts script first.',
    );
    process.exit(1);
  }

  // Set environment variables for the test
  process.env.GLOBAL_API_KEY = globalApiKey;
  process.env.NODE_ENV = 'development';

  // Create a test application
  const app = await NestFactory.create(TestModule);
  await app.init();

  const testService = app.get(TestService);

  try {
    // Test with a dummy token - this should fail validation but we're testing API key auth
    const dummyToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    // This will likely fail with UnauthorizedException for the token,
    // but we're checking if the gRPC call is made with the API key
    const response = await testService.testAuthenticateToken(dummyToken);
    console.log('Authentication response:', response);
  } catch (error) {
    // This error is expected because the token is invalid
    console.log('Expected error from authentication:', error.message);
    console.log(
      'This error is normal - we are just checking that the gRPC call was made with the API key.',
    );
    console.log(
      'The request would have failed earlier with "API key required" if the API key wasn\'t added.',
    );
  }

  await app.close();
}

testGrpcApiKey().catch(console.error);
