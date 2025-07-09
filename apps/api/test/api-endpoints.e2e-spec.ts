import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '@bitsacco/common';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

describe('API Endpoints Integration Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  // Mock user model
  const mockUsersModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  // Mock token model
  const mockTokenModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    deleteMany: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          load: [
            () => ({
              JWT_SECRET: 'test-secret',
              JWT_EXPIRATION: '3600',
              AUTH_JWT_SECRET: 'test-auth-secret',
              AUTH_JWT_EXPIRATION: '3600',
              AUTH_JWT_AUD: 'test-audience',
              AUTH_JWT_ISS: 'test-issuer',
              SALT_ROUNDS: '10',
              DATABASE_URL: 'mongodb://localhost:27017/test',
              SMS_AT_API_KEY: 'test-key',
              SMS_AT_USERNAME: 'test-user',
              SMS_AT_FROM: 'TEST',
              SMS_AT_KEYWORD: 'test',
            }),
          ],
        }),
        PassportModule,
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get<string>('JWT_SECRET'),
            signOptions: { expiresIn: '15m' },
          }),
          inject: [ConfigService],
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        UsersService,
        JwtStrategy,
        {
          provide: getModelToken('UsersDocument'),
          useValue: mockUsersModel,
        },
        {
          provide: getModelToken('TokenDocument'),
          useValue: mockTokenModel,
        },
        {
          provide: 'UsersRepository',
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: 'SmsService',
          useValue: {
            sendSms: jest.fn().mockResolvedValue({ success: true }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create test token
    authToken = jwtService.sign({
      sub: 'test-user-id',
      phoneNumber: '+254700000000',
      role: 'Member',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth Endpoints', () => {
    describe('POST /auth/register', () => {
      it('should register a new user', async () => {
        mockUsersModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        });

        mockUsersModel.create.mockResolvedValue({
          _id: 'new-user-id',
          phoneNumber: '+254700000001',
          save: jest.fn().mockResolvedValue({
            _id: 'new-user-id',
            phoneNumber: '+254700000001',
          }),
        });

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({ phoneNumber: '+254700000001' })
          .expect(201);

        expect(response.body).toHaveProperty('userId');
        expect(response.body).toHaveProperty('phoneNumber', '+254700000001');
      });

      it('should reject duplicate registration', async () => {
        mockUsersModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: 'existing-user',
            phoneNumber: '+254700000001',
          }),
        });

        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ phoneNumber: '+254700000001' })
          .expect(409);
      });

      it('should validate phone number format', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ phoneNumber: 'invalid' })
          .expect(400);
      });
    });

    describe('POST /auth/verify', () => {
      it('should verify OTP and return tokens', async () => {
        const mockUser = {
          _id: 'test-user-id',
          phoneNumber: '+254700000000',
          isAuthorized: false,
          toObject: jest.fn().mockReturnValue({
            _id: 'test-user-id',
            phoneNumber: '+254700000000',
          }),
        };

        mockUsersModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser),
        });

        mockUsersModel.findByIdAndUpdate.mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockUser,
            isAuthorized: true,
          }),
        });

        const response = await request(app.getHttpServer())
          .post('/auth/verify')
          .send({
            phoneNumber: '+254700000000',
            otp: '123456',
          })
          .expect(200);

        expect(response.body).toHaveProperty('access_token');
        expect(response.body).toHaveProperty('refresh_token');
        expect(response.body).toHaveProperty('user');
      });

      it('should reject invalid OTP', async () => {
        mockUsersModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: 'test-user-id',
            phoneNumber: '+254700000000',
          }),
        });

        await request(app.getHttpServer())
          .post('/auth/verify')
          .send({
            phoneNumber: '+254700000000',
            otp: 'invalid',
          })
          .expect(401);
      });
    });

    describe('GET /auth/protected', () => {
      it('should allow access with valid token', async () => {
        mockUsersModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: 'test-user-id',
            phoneNumber: '+254700000000',
            isAuthorized: true,
          }),
        });

        await request(app.getHttpServer())
          .get('/auth/protected')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      });

      it('should reject access without token', async () => {
        await request(app.getHttpServer()).get('/auth/protected').expect(401);
      });

      it('should reject access with invalid token', async () => {
        await request(app.getHttpServer())
          .get('/auth/protected')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
});
