// Must load environment variables before any other imports
import './setup-test-env';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ApiModule } from '../src/api.module';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import {
  UsersDocument,
  TokenDocument,
  Role,
  AuthTokenPayload,
} from '@bitsacco/common';

describe('Bitsacco API Integration Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let configService: ConfigService;
  let authToken: string;
  let refreshToken: string;
  let userId: string;
  let chamaId: string;
  let swapId: string;
  let sharesOfferId: string;
  let notificationId: string;

  // Mock repositories
  const mockUsersModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockTokenModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockChamasModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockSharesOfferModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockSharesModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockNotificationModel = {
    create: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
    countDocuments: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockNotificationPreferencesModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockMpesaOnrampSwapModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockMpesaOfframpSwapModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockSolowalletModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockChamaWalletModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockApiKeyModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  // Mock external services
  const mockHttpService = {
    axiosRef: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };

  const mockFedimintService = {
    requestInvoice: jest.fn().mockResolvedValue({
      operationId: 'test-op-id',
      invoice: 'test-invoice',
    }),
    pay: jest.fn().mockResolvedValue({
      operationId: 'test-op-id',
      txid: 'test-txid',
    }),
    getBalance: jest.fn().mockResolvedValue({ msats: 1000000 }),
  };

  const mockIntasendService = {
    stkPush: jest.fn().mockResolvedValue({
      id: 'test-intasend-id',
      state: 'PENDING',
    }),
    checkTransactionStatus: jest.fn().mockResolvedValue({
      state: 'COMPLETED',
    }),
  };

  const mockBitlyClient = {
    shorten: jest.fn().mockResolvedValue({ link: 'https://bit.ly/test' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
    })
      .overrideProvider(getModelToken(UsersDocument.name))
      .useValue(mockUsersModel)
      .overrideProvider(getModelToken(TokenDocument.name))
      .useValue(mockTokenModel)
      .overrideProvider(getModelToken('ChamasDocument'))
      .useValue(mockChamasModel)
      .overrideProvider(getModelToken('SharesOfferDocument'))
      .useValue(mockSharesOfferModel)
      .overrideProvider(getModelToken('SharesDocument'))
      .useValue(mockSharesModel)
      .overrideProvider(getModelToken('NotificationDocument'))
      .useValue(mockNotificationModel)
      .overrideProvider(getModelToken('NotificationPreferencesDocument'))
      .useValue(mockNotificationPreferencesModel)
      .overrideProvider(getModelToken('MpesaOnrampSwapDocument'))
      .useValue(mockMpesaOnrampSwapModel)
      .overrideProvider(getModelToken('MpesaOfframpSwapDocument'))
      .useValue(mockMpesaOfframpSwapModel)
      .overrideProvider(getModelToken('SolowalletDocument'))
      .useValue(mockSolowalletModel)
      .overrideProvider(getModelToken('ChamaWalletDocument'))
      .useValue(mockChamaWalletModel)
      .overrideProvider(getModelToken('ApiKeyDocument'))
      .useValue(mockApiKeyModel)
      .overrideProvider('HttpService')
      .useValue(mockHttpService)
      .overrideProvider('FedimintService')
      .useValue(mockFedimintService)
      .overrideProvider('IntasendService')
      .useValue(mockIntasendService)
      .overrideProvider('BitlyClient')
      .useValue(mockBitlyClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    // Create test user and tokens
    userId = 'test-user-id';
    const mockUser = {
      _id: userId,
      id: userId,
      phoneNumber: '+254700000000',
      role: Role.Member,
      isAuthorized: true,
      chamaIds: [],
      toObject: jest.fn().mockReturnValue({
        _id: userId,
        id: userId,
        phoneNumber: '+254700000000',
        role: Role.Member,
        isAuthorized: true,
      }),
    };

    mockUsersModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockUser),
    });
    mockUsersModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockUser),
    });

    // Generate auth tokens
    const tokenPayload: AuthTokenPayload = {
      sub: userId,
      phoneNumber: '+254700000000',
      role: Role.Member,
    };

    authToken = jwtService.sign(tokenPayload, {
      secret: configService.get('JWT_SECRET'),
      expiresIn: '15m',
    });

    refreshToken = jwtService.sign(
      { sub: userId, type: 'refresh' },
      {
        secret:
          configService.get('AUTH_JWT_SECRET') ||
          configService.get('JWT_SECRET'),
        expiresIn: '7d',
      },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('GET /health should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
        });
    });

    it('GET /health/ready should return readiness status', () => {
      return request(app.getHttpServer())
        .get('/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('checks');
        });
    });
  });

  describe('Auth Endpoints', () => {
    describe('POST /auth/register', () => {
      it('should register a new user', async () => {
        const registerDto = {
          phoneNumber: '+254700000001',
        };

        mockUsersModel.findOne.mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        });

        const newUser = {
          _id: 'new-user-id',
          id: 'new-user-id',
          phoneNumber: registerDto.phoneNumber,
          role: Role.Member,
          isAuthorized: false,
          chamaIds: [],
          toObject: jest.fn().mockReturnValue({
            _id: 'new-user-id',
            phoneNumber: registerDto.phoneNumber,
            role: Role.Member,
            isAuthorized: false,
          }),
        };

        mockUsersModel.create.mockResolvedValue(newUser);

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(registerDto)
          .expect(201);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty(
          'phoneNumber',
          registerDto.phoneNumber,
        );
        expect(response.body).toHaveProperty('success', true);
      });

      it('should return 400 for invalid phone number', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({ phoneNumber: 'invalid' })
          .expect(400);
      });
    });

    describe('POST /auth/login', () => {
      it('should login an existing user', async () => {
        const loginDto = {
          phoneNumber: '+254700000000',
        };

        const mockUser = {
          _id: userId,
          id: userId,
          phoneNumber: loginDto.phoneNumber,
          role: Role.Member,
          isAuthorized: false,
          chamaIds: [],
          toObject: jest.fn().mockReturnValue({
            _id: userId,
            phoneNumber: loginDto.phoneNumber,
            role: Role.Member,
            isAuthorized: false,
          }),
        };

        mockUsersModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser),
        });

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('POST /auth/verify', () => {
      it('should verify user with OTP', async () => {
        const verifyDto = {
          phoneNumber: '+254700000000',
          code: '123456',
        };

        const mockUser = {
          _id: userId,
          id: userId,
          phoneNumber: verifyDto.phoneNumber,
          role: Role.Member,
          isAuthorized: true,
          chamaIds: [],
          toObject: jest.fn().mockReturnValue({
            _id: userId,
            phoneNumber: verifyDto.phoneNumber,
            role: Role.Member,
            isAuthorized: true,
          }),
        };

        mockUsersModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser),
        });

        mockTokenModel.create.mockResolvedValue({
          tokenId: 'refresh-token-id',
          userId: userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const response = await request(app.getHttpServer())
          .post('/auth/verify')
          .send(verifyDto)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
      });
    });

    describe('GET /auth/authenticate', () => {
      it('should authenticate with valid token', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/authenticate')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('accessToken');
      });

      it('should return 401 without token', () => {
        return request(app.getHttpServer())
          .get('/auth/authenticate')
          .expect(401);
      });
    });

    describe('POST /auth/refresh', () => {
      it('should refresh tokens', async () => {
        mockTokenModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            tokenId: 'refresh-token-id',
            userId: userId,
            revoked: false,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
        });

        mockTokenModel.create.mockResolvedValue({
          tokenId: 'new-refresh-token-id',
          userId: userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const response = await request(app.getHttpServer())
          .post('/auth/refresh')
          .set('Cookie', `refreshToken=${refreshToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
      });
    });

    describe('POST /auth/logout', () => {
      it('should logout user', async () => {
        mockTokenModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

        await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Cookie', `refreshToken=${refreshToken}`)
          .expect(200);
      });
    });
  });

  describe('User Endpoints', () => {
    describe('GET /users/profile', () => {
      it('should get user profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('_id', userId);
        expect(response.body).toHaveProperty('phoneNumber');
        expect(response.body).toHaveProperty('role');
      });

      it('should return 401 without auth', () => {
        return request(app.getHttpServer()).get('/users/profile').expect(401);
      });
    });

    describe('PUT /users/profile', () => {
      it('should update user profile', async () => {
        const updateDto = {
          name: 'Test User',
          email: 'test@example.com',
        };

        const updatedUser = {
          _id: userId,
          id: userId,
          phoneNumber: '+254700000000',
          name: updateDto.name,
          email: updateDto.email,
          role: Role.Member,
          isAuthorized: true,
          chamaIds: [],
          toObject: jest.fn().mockReturnValue({
            _id: userId,
            phoneNumber: '+254700000000',
            name: updateDto.name,
            email: updateDto.email,
            role: Role.Member,
            isAuthorized: true,
          }),
        };

        mockUsersModel.findByIdAndUpdate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedUser),
        });

        const response = await request(app.getHttpServer())
          .put('/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateDto)
          .expect(200);

        expect(response.body).toHaveProperty('name', updateDto.name);
        expect(response.body).toHaveProperty('email', updateDto.email);
      });
    });
  });

  describe('Chama Endpoints', () => {
    beforeEach(() => {
      chamaId = 'test-chama-id';
    });

    describe('POST /chamas', () => {
      it('should create a new chama', async () => {
        const createChamaDto = {
          name: 'Test Chama',
          description: 'Test chama description',
          contributionAmount: 1000,
          contributionFrequency: 'WEEKLY',
        };

        const newChama = {
          _id: chamaId,
          id: chamaId,
          ...createChamaDto,
          createdBy: userId,
          members: [
            {
              memberId: userId,
              role: 'ADMIN',
              joinedAt: new Date(),
            },
          ],
          createdAt: new Date(),
          toObject: jest.fn().mockReturnValue({
            _id: chamaId,
            ...createChamaDto,
            createdBy: userId,
            members: [
              {
                memberId: userId,
                role: 'ADMIN',
                joinedAt: new Date(),
              },
            ],
          }),
        };

        mockChamasModel.create.mockResolvedValue(newChama);

        const response = await request(app.getHttpServer())
          .post('/chamas')
          .set('Authorization', `Bearer ${authToken}`)
          .send(createChamaDto)
          .expect(201);

        expect(response.body).toHaveProperty('_id');
        expect(response.body).toHaveProperty('name', createChamaDto.name);
        expect(response.body).toHaveProperty(
          'description',
          createChamaDto.description,
        );
      });
    });

    describe('GET /chamas/:id', () => {
      it('should get chama details', async () => {
        const mockChama = {
          _id: chamaId,
          id: chamaId,
          name: 'Test Chama',
          description: 'Test chama description',
          members: [
            {
              memberId: userId,
              role: 'ADMIN',
              joinedAt: new Date(),
            },
          ],
          toObject: jest.fn().mockReturnValue({
            _id: chamaId,
            name: 'Test Chama',
            description: 'Test chama description',
            members: [
              {
                memberId: userId,
                role: 'ADMIN',
                joinedAt: new Date(),
              },
            ],
          }),
        };

        mockChamasModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockChama),
        });

        const response = await request(app.getHttpServer())
          .get(`/chamas/${chamaId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('_id', chamaId);
        expect(response.body).toHaveProperty('name');
      });
    });

    describe('PUT /chamas/:id', () => {
      it('should update chama details', async () => {
        const updateDto = {
          description: 'Updated description',
          contributionAmount: 2000,
        };

        const mockChama = {
          _id: chamaId,
          id: chamaId,
          name: 'Test Chama',
          description: 'Test chama description',
          members: [
            {
              memberId: userId,
              role: 'ADMIN',
              joinedAt: new Date(),
            },
          ],
          findMember: jest.fn().mockReturnValue({
            memberId: userId,
            role: 'ADMIN',
          }),
        };

        const updatedChama = {
          ...mockChama,
          ...updateDto,
          toObject: jest.fn().mockReturnValue({
            _id: chamaId,
            name: 'Test Chama',
            ...updateDto,
            members: [
              {
                memberId: userId,
                role: 'ADMIN',
                joinedAt: new Date(),
              },
            ],
          }),
        };

        mockChamasModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockChama),
        });

        mockChamasModel.findByIdAndUpdate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedChama),
        });

        const response = await request(app.getHttpServer())
          .put(`/chamas/${chamaId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateDto)
          .expect(200);

        expect(response.body).toHaveProperty(
          'description',
          updateDto.description,
        );
        expect(response.body).toHaveProperty(
          'contributionAmount',
          updateDto.contributionAmount,
        );
      });
    });

    describe('POST /chamas/:id/join', () => {
      it('should join a chama', async () => {
        const joinDto = {
          inviteCode: 'test-invite-code',
        };

        const mockChama = {
          _id: chamaId,
          id: chamaId,
          name: 'Test Chama',
          members: [],
          addMember: jest.fn(),
          save: jest.fn().mockResolvedValue({
            _id: chamaId,
            name: 'Test Chama',
            members: [
              {
                memberId: userId,
                role: 'MEMBER',
                joinedAt: new Date(),
              },
            ],
            toObject: jest.fn().mockReturnValue({
              _id: chamaId,
              name: 'Test Chama',
              members: [
                {
                  memberId: userId,
                  role: 'MEMBER',
                  joinedAt: new Date(),
                },
              ],
            }),
          }),
        };

        mockChamasModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockChama),
        });

        const response = await request(app.getHttpServer())
          .post(`/chamas/${chamaId}/join`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(joinDto)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('GET /chamas', () => {
      it('should list user chamas', async () => {
        const mockChamas = [
          {
            _id: chamaId,
            name: 'Test Chama 1',
            members: [{ memberId: userId, role: 'ADMIN' }],
            toObject: jest.fn().mockReturnValue({
              _id: chamaId,
              name: 'Test Chama 1',
              members: [{ memberId: userId, role: 'ADMIN' }],
            }),
          },
          {
            _id: 'chama-2',
            name: 'Test Chama 2',
            members: [{ memberId: userId, role: 'MEMBER' }],
            toObject: jest.fn().mockReturnValue({
              _id: 'chama-2',
              name: 'Test Chama 2',
              members: [{ memberId: userId, role: 'MEMBER' }],
            }),
          },
        ];

        mockChamasModel.find.mockReturnValue({
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockChamas),
        });

        mockChamasModel.countDocuments.mockReturnValue({
          exec: jest.fn().mockResolvedValue(2),
        });

        const response = await request(app.getHttpServer())
          .get('/chamas')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 0, size: 10 })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveLength(2);
        expect(response.body).toHaveProperty('total', 2);
        expect(response.body).toHaveProperty('page', 0);
        expect(response.body).toHaveProperty('size', 10);
      });
    });

    describe('GET /chamas/:id/members', () => {
      it('should get chama member profiles', async () => {
        const mockChama = {
          _id: chamaId,
          name: 'Test Chama',
          members: [
            { memberId: userId, role: 'ADMIN' },
            { memberId: 'member-2', role: 'MEMBER' },
          ],
        };

        const mockUsers = [
          {
            _id: userId,
            phoneNumber: '+254700000000',
            name: 'Admin User',
            toObject: jest.fn().mockReturnValue({
              _id: userId,
              phoneNumber: '+254700000000',
              name: 'Admin User',
            }),
          },
          {
            _id: 'member-2',
            phoneNumber: '+254700000001',
            name: 'Member User',
            toObject: jest.fn().mockReturnValue({
              _id: 'member-2',
              phoneNumber: '+254700000001',
              name: 'Member User',
            }),
          },
        ];

        mockChamasModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockChama),
        });

        mockUsersModel.find.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUsers),
        });

        const response = await request(app.getHttpServer())
          .get(`/chamas/${chamaId}/members`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0]).toHaveProperty('profile');
        expect(response.body[0]).toHaveProperty('role');
      });
    });
  });

  describe('Swap Endpoints', () => {
    beforeEach(() => {
      swapId = 'test-swap-id';
    });

    describe('POST /swap/quote', () => {
      it('should get a swap quote', async () => {
        const quoteDto = {
          from: 'KES',
          to: 'BTC',
          amount: '1000',
        };

        const response = await request(app.getHttpServer())
          .post('/swap/quote')
          .set('Authorization', `Bearer ${authToken}`)
          .send(quoteDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('from', quoteDto.from);
        expect(response.body).toHaveProperty('to', quoteDto.to);
        expect(response.body).toHaveProperty('rate');
        expect(response.body).toHaveProperty('expiresAt');
      });
    });

    describe('POST /swap/onramp', () => {
      it('should create an onramp swap', async () => {
        const onrampDto = {
          phoneNumber: '+254700000000',
          amountFiat: 1000,
          currency: 'KES',
        };

        const mockSwap = {
          _id: swapId,
          id: swapId,
          userId: userId,
          phoneNumber: onrampDto.phoneNumber,
          amountFiat: onrampDto.amountFiat,
          currency: onrampDto.currency,
          amountBtc: 0.00001,
          rate: 100000000,
          status: 'PENDING',
          createdAt: new Date(),
          toObject: jest.fn().mockReturnValue({
            _id: swapId,
            userId: userId,
            phoneNumber: onrampDto.phoneNumber,
            amountFiat: onrampDto.amountFiat,
            currency: onrampDto.currency,
            amountBtc: 0.00001,
            rate: 100000000,
            status: 'PENDING',
          }),
        };

        mockMpesaOnrampSwapModel.create.mockResolvedValue(mockSwap);

        const response = await request(app.getHttpServer())
          .post('/swap/onramp')
          .set('Authorization', `Bearer ${authToken}`)
          .send(onrampDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty(
          'amountFiat',
          onrampDto.amountFiat,
        );
        expect(response.body).toHaveProperty('currency', onrampDto.currency);
        expect(response.body).toHaveProperty('status', 'PENDING');
      });
    });

    describe('GET /swap/onramp/:id', () => {
      it('should get onramp swap details', async () => {
        const mockSwap = {
          _id: swapId,
          id: swapId,
          userId: userId,
          phoneNumber: '+254700000000',
          amountFiat: 1000,
          currency: 'KES',
          amountBtc: 0.00001,
          rate: 100000000,
          status: 'COMPLETE',
          toObject: jest.fn().mockReturnValue({
            _id: swapId,
            userId: userId,
            phoneNumber: '+254700000000',
            amountFiat: 1000,
            currency: 'KES',
            amountBtc: 0.00001,
            rate: 100000000,
            status: 'COMPLETE',
          }),
        };

        mockMpesaOnrampSwapModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSwap),
        });

        const response = await request(app.getHttpServer())
          .get(`/swap/onramp/${swapId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', swapId);
        expect(response.body).toHaveProperty('status', 'COMPLETE');
      });
    });

    describe('GET /swap/onramp', () => {
      it('should list user onramp swaps', async () => {
        const mockSwaps = [
          {
            _id: swapId,
            userId: userId,
            amountFiat: 1000,
            status: 'COMPLETE',
            toObject: jest.fn().mockReturnValue({
              _id: swapId,
              userId: userId,
              amountFiat: 1000,
              status: 'COMPLETE',
            }),
          },
        ];

        mockMpesaOnrampSwapModel.find.mockReturnValue({
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockSwaps),
        });

        mockMpesaOnrampSwapModel.countDocuments.mockReturnValue({
          exec: jest.fn().mockResolvedValue(1),
        });

        const response = await request(app.getHttpServer())
          .get('/swap/onramp')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 0, size: 10 })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveLength(1);
        expect(response.body).toHaveProperty('total', 1);
      });
    });

    describe('POST /swap/offramp', () => {
      it('should create an offramp swap', async () => {
        const offrampDto = {
          phoneNumber: '+254700000000',
          amountBtc: 0.00001,
          currency: 'KES',
        };

        const mockSwap = {
          _id: swapId,
          id: swapId,
          userId: userId,
          phoneNumber: offrampDto.phoneNumber,
          amountBtc: offrampDto.amountBtc,
          currency: offrampDto.currency,
          amountFiat: 1000,
          rate: 100000000,
          status: 'PENDING',
          createdAt: new Date(),
          toObject: jest.fn().mockReturnValue({
            _id: swapId,
            userId: userId,
            phoneNumber: offrampDto.phoneNumber,
            amountBtc: offrampDto.amountBtc,
            currency: offrampDto.currency,
            amountFiat: 1000,
            rate: 100000000,
            status: 'PENDING',
          }),
        };

        mockMpesaOfframpSwapModel.create.mockResolvedValue(mockSwap);

        const response = await request(app.getHttpServer())
          .post('/swap/offramp')
          .set('Authorization', `Bearer ${authToken}`)
          .send(offrampDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('amountBtc', offrampDto.amountBtc);
        expect(response.body).toHaveProperty('currency', offrampDto.currency);
        expect(response.body).toHaveProperty('status', 'PENDING');
      });
    });
  });

  describe('Shares Endpoints', () => {
    beforeEach(() => {
      sharesOfferId = 'test-shares-offer-id';
    });

    describe('POST /shares/offer', () => {
      it('should create a shares offer', async () => {
        const offerDto = {
          quantity: 100,
          pricePerShare: 1000,
        };

        const mockOffer = {
          _id: sharesOfferId,
          id: sharesOfferId,
          userId: userId,
          quantity: offerDto.quantity,
          pricePerShare: offerDto.pricePerShare,
          availableQuantity: offerDto.quantity,
          status: 'ACTIVE',
          createdAt: new Date(),
          toObject: jest.fn().mockReturnValue({
            _id: sharesOfferId,
            userId: userId,
            quantity: offerDto.quantity,
            pricePerShare: offerDto.pricePerShare,
            availableQuantity: offerDto.quantity,
            status: 'ACTIVE',
          }),
        };

        mockSharesOfferModel.create.mockResolvedValue(mockOffer);

        const response = await request(app.getHttpServer())
          .post('/shares/offer')
          .set('Authorization', `Bearer ${authToken}`)
          .send(offerDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('quantity', offerDto.quantity);
        expect(response.body).toHaveProperty(
          'pricePerShare',
          offerDto.pricePerShare,
        );
        expect(response.body).toHaveProperty('status', 'ACTIVE');
      });
    });

    describe('POST /shares/subscribe', () => {
      it('should subscribe to shares', async () => {
        const subscribeDto = {
          offerId: sharesOfferId,
          quantity: 50,
        };

        const mockOffer = {
          _id: sharesOfferId,
          userId: 'seller-id',
          quantity: 100,
          availableQuantity: 100,
          pricePerShare: 1000,
          status: 'ACTIVE',
          save: jest.fn(),
        };

        const mockShares = {
          _id: 'shares-id',
          userId: userId,
          quantity: 50,
          acquisitionPrice: 1000,
          offerId: sharesOfferId,
          toObject: jest.fn().mockReturnValue({
            _id: 'shares-id',
            userId: userId,
            quantity: 50,
            acquisitionPrice: 1000,
            offerId: sharesOfferId,
          }),
        };

        mockSharesOfferModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOffer),
        });

        mockSharesModel.create.mockResolvedValue(mockShares);

        // Mock total shares check
        mockSharesModel.find.mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        });

        const response = await request(app.getHttpServer())
          .post('/shares/subscribe')
          .set('Authorization', `Bearer ${authToken}`)
          .send(subscribeDto)
          .expect(201);

        expect(response.body).toHaveProperty('transactionId');
        expect(response.body).toHaveProperty('quantity', subscribeDto.quantity);
        expect(response.body).toHaveProperty('totalAmount', 50000); // 50 * 1000
      });
    });

    describe('GET /shares/offers', () => {
      it('should list available shares offers', async () => {
        const mockOffers = [
          {
            _id: sharesOfferId,
            userId: 'seller-id',
            quantity: 100,
            availableQuantity: 50,
            pricePerShare: 1000,
            status: 'ACTIVE',
            toObject: jest.fn().mockReturnValue({
              _id: sharesOfferId,
              userId: 'seller-id',
              quantity: 100,
              availableQuantity: 50,
              pricePerShare: 1000,
              status: 'ACTIVE',
            }),
          },
        ];

        mockSharesOfferModel.find.mockReturnValue({
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockOffers),
        });

        mockSharesOfferModel.countDocuments.mockReturnValue({
          exec: jest.fn().mockResolvedValue(1),
        });

        const response = await request(app.getHttpServer())
          .get('/shares/offers')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 0, size: 10 })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveLength(1);
        expect(response.body).toHaveProperty('total', 1);
      });
    });

    describe('POST /shares/transfer', () => {
      it('should transfer shares to another user', async () => {
        const transferDto = {
          recipientId: 'recipient-user-id',
          quantity: 25,
        };

        const senderShares = {
          _id: 'sender-shares-id',
          userId: userId,
          quantity: 50,
          available: 50,
          save: jest.fn(),
        };

        const recipientShares = {
          _id: 'recipient-shares-id',
          userId: transferDto.recipientId,
          quantity: 25,
          toObject: jest.fn().mockReturnValue({
            _id: 'recipient-shares-id',
            userId: transferDto.recipientId,
            quantity: 25,
          }),
        };

        mockSharesModel.findOne.mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(senderShares),
        });

        mockSharesModel.findOne.mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null), // No existing shares for recipient
        });

        mockSharesModel.create.mockResolvedValue(recipientShares);

        // Mock total shares check
        mockSharesModel.find.mockReturnValue({
          exec: jest.fn().mockResolvedValue([recipientShares]),
        });

        const response = await request(app.getHttpServer())
          .post('/shares/transfer')
          .set('Authorization', `Bearer ${authToken}`)
          .send(transferDto)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('transferId');
      });
    });
  });

  describe('Notification Endpoints', () => {
    beforeEach(() => {
      notificationId = 'test-notification-id';
    });

    describe('GET /notifications', () => {
      it('should get user notifications', async () => {
        const mockNotifications = [
          {
            _id: notificationId,
            userId: userId,
            title: 'Test Notification',
            message: 'This is a test notification',
            type: 'INFO',
            read: false,
            createdAt: new Date(),
            toObject: jest.fn().mockReturnValue({
              _id: notificationId,
              userId: userId,
              title: 'Test Notification',
              message: 'This is a test notification',
              type: 'INFO',
              read: false,
            }),
          },
        ];

        mockNotificationModel.find.mockReturnValue({
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockNotifications),
        });

        mockNotificationModel.countDocuments.mockReturnValue({
          exec: jest.fn().mockResolvedValue(1),
        });

        const response = await request(app.getHttpServer())
          .get('/notifications')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 0, size: 10, unreadOnly: true })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveLength(1);
        expect(response.body).toHaveProperty('total', 1);
      });
    });

    describe('POST /notifications/mark-read', () => {
      it('should mark notifications as read', async () => {
        const markReadDto = {
          notificationIds: [notificationId],
        };

        mockNotificationModel.updateMany.mockResolvedValue({
          modifiedCount: 1,
        });

        const response = await request(app.getHttpServer())
          .post('/notifications/mark-read')
          .set('Authorization', `Bearer ${authToken}`)
          .send(markReadDto)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('modifiedCount', 1);
      });

      it('should mark all notifications as read when no IDs provided', async () => {
        mockNotificationModel.updateMany.mockResolvedValue({
          modifiedCount: 5,
        });

        const response = await request(app.getHttpServer())
          .post('/notifications/mark-read')
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('modifiedCount', 5);
      });
    });

    describe('GET /notifications/preferences', () => {
      it('should get notification preferences', async () => {
        const mockPreferences = {
          _id: 'pref-id',
          userId: userId,
          channels: ['SMS', 'PUSH'],
          topics: ['TRANSACTION', 'CHAMA'],
          importance: ['HIGH', 'CRITICAL'],
          toObject: jest.fn().mockReturnValue({
            _id: 'pref-id',
            userId: userId,
            channels: ['SMS', 'PUSH'],
            topics: ['TRANSACTION', 'CHAMA'],
            importance: ['HIGH', 'CRITICAL'],
          }),
        };

        mockNotificationPreferencesModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockPreferences),
        });

        const response = await request(app.getHttpServer())
          .get('/notifications/preferences')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('userId', userId);
        expect(response.body).toHaveProperty('channels');
        expect(response.body.channels).toContain('SMS');
        expect(response.body.channels).toContain('PUSH');
      });
    });

    describe('PUT /notifications/preferences', () => {
      it('should update notification preferences', async () => {
        const updateDto = {
          channels: ['SMS', 'EMAIL'],
          topics: ['TRANSACTION'],
          importance: ['CRITICAL'],
        };

        const updatedPreferences = {
          _id: 'pref-id',
          userId: userId,
          ...updateDto,
          toObject: jest.fn().mockReturnValue({
            _id: 'pref-id',
            userId: userId,
            ...updateDto,
          }),
        };

        mockNotificationPreferencesModel.findOneAndUpdate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedPreferences),
        });

        const response = await request(app.getHttpServer())
          .put('/notifications/preferences')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateDto)
          .expect(200);

        expect(response.body).toHaveProperty('channels');
        expect(response.body.channels).toEqual(updateDto.channels);
        expect(response.body).toHaveProperty('topics');
        expect(response.body.topics).toEqual(updateDto.topics);
      });
    });
  });

  describe('SMS Endpoints', () => {
    describe('POST /sms/send', () => {
      it('should send SMS (admin only)', async () => {
        // Create admin token
        const adminTokenPayload: AuthTokenPayload = {
          sub: 'admin-id',
          phoneNumber: '+254700000999',
          role: Role.Admin,
        };

        const adminToken = jwtService.sign(adminTokenPayload, {
          secret: configService.get('JWT_SECRET'),
          expiresIn: '15m',
        });

        const sendSmsDto = {
          receiver: '+254700000001',
          message: 'Test SMS message',
        };

        const mockAdminUser = {
          _id: 'admin-id',
          phoneNumber: '+254700000999',
          role: Role.Admin,
          isAuthorized: true,
          toObject: jest.fn().mockReturnValue({
            _id: 'admin-id',
            phoneNumber: '+254700000999',
            role: Role.Admin,
            isAuthorized: true,
          }),
        };

        mockUsersModel.findById.mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(mockAdminUser),
        });

        const response = await request(app.getHttpServer())
          .post('/sms/send')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(sendSmsDto)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('messageId');
      });

      it('should return 403 for non-admin users', async () => {
        const sendSmsDto = {
          receiver: '+254700000001',
          message: 'Test SMS message',
        };

        return request(app.getHttpServer())
          .post('/sms/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send(sendSmsDto)
          .expect(403);
      });
    });
  });

  describe('Nostr Endpoints', () => {
    describe('POST /nostr/relays', () => {
      it('should configure Nostr relays', async () => {
        const relaysDto = {
          relays: ['wss://relay.damus.io', 'wss://nos.lol'],
        };

        const response = await request(app.getHttpServer())
          .post('/nostr/relays')
          .set('Authorization', `Bearer ${authToken}`)
          .send(relaysDto)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('connectedRelays');
        expect(response.body.connectedRelays).toEqual(
          expect.arrayContaining(relaysDto.relays),
        );
      });
    });

    describe('POST /nostr/dm', () => {
      it('should send encrypted Nostr DM', async () => {
        const dmDto = {
          recipientNpub: 'npub1...',
          message: 'Hello from test',
        };

        const response = await request(app.getHttpServer())
          .post('/nostr/dm')
          .set('Authorization', `Bearer ${authToken}`)
          .send(dmDto)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('eventId');
      });
    });
  });

  describe('SoloWallet Endpoints', () => {
    describe('POST /solowallet/deposit', () => {
      it('should create a deposit invoice', async () => {
        const depositDto = {
          amountMsats: 1000000, // 1000 sats
          description: 'Test deposit',
        };

        const mockWallet = {
          _id: 'wallet-id',
          userId: userId,
          balance: 0,
          save: jest.fn(),
        };

        mockSolowalletModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWallet),
        });

        const response = await request(app.getHttpServer())
          .post('/solowallet/deposit')
          .set('Authorization', `Bearer ${authToken}`)
          .send(depositDto)
          .expect(201);

        expect(response.body).toHaveProperty('invoice');
        expect(response.body).toHaveProperty('operationId');
        expect(response.body).toHaveProperty('expiresAt');
      });
    });

    describe('POST /solowallet/withdraw', () => {
      it('should withdraw funds via lightning invoice', async () => {
        const withdrawDto = {
          invoice: 'lnbc1...',
        };

        const mockWallet = {
          _id: 'wallet-id',
          userId: userId,
          balance: 10000000, // 10000 sats
          save: jest.fn(),
        };

        mockSolowalletModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWallet),
        });

        const response = await request(app.getHttpServer())
          .post('/solowallet/withdraw')
          .set('Authorization', `Bearer ${authToken}`)
          .send(withdrawDto)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('operationId');
        expect(response.body).toHaveProperty('preimage');
      });

      it('should return 400 for insufficient balance', async () => {
        const withdrawDto = {
          invoice: 'lnbc1...',
        };

        const mockWallet = {
          _id: 'wallet-id',
          userId: userId,
          balance: 0,
          save: jest.fn(),
        };

        mockSolowalletModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWallet),
        });

        return request(app.getHttpServer())
          .post('/solowallet/withdraw')
          .set('Authorization', `Bearer ${authToken}`)
          .send(withdrawDto)
          .expect(400);
      });
    });

    describe('GET /solowallet/balance', () => {
      it('should get wallet balance', async () => {
        const mockWallet = {
          _id: 'wallet-id',
          userId: userId,
          balance: 5000000, // 5000 sats
          toObject: jest.fn().mockReturnValue({
            _id: 'wallet-id',
            userId: userId,
            balance: 5000000,
          }),
        };

        mockSolowalletModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWallet),
        });

        const response = await request(app.getHttpServer())
          .get('/solowallet/balance')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('balance', 5000000);
        expect(response.body).toHaveProperty('balanceSats', 5000);
        expect(response.body).toHaveProperty('userId', userId);
      });
    });

    describe('GET /solowallet/transactions', () => {
      it('should list wallet transactions', async () => {
        const mockTransactions = [
          {
            _id: 'tx-1',
            userId: userId,
            type: 'DEPOSIT',
            amount: 1000000,
            status: 'COMPLETE',
            createdAt: new Date(),
            toObject: jest.fn().mockReturnValue({
              _id: 'tx-1',
              userId: userId,
              type: 'DEPOSIT',
              amount: 1000000,
              status: 'COMPLETE',
            }),
          },
        ];

        // Mock implementation would depend on transaction model
        // For now, returning mock data directly
        const response = await request(app.getHttpServer())
          .get('/solowallet/transactions')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 0, size: 10 })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page', 0);
        expect(response.body).toHaveProperty('size', 10);
      });
    });
  });

  describe('Metrics Endpoint', () => {
    it('GET /metrics should return prometheus metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
      expect(response.text).toContain('nodejs_');
    });
  });

  describe('API Documentation', () => {
    it('GET /api should return swagger documentation', async () => {
      const response = await request(app.getHttpServer())
        .get('/api')
        .expect(200);

      expect(response.text).toContain('Swagger UI');
      expect(response.text).toContain('Bitsacco API');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit requests when threshold is exceeded', async () => {
      // Make multiple requests quickly
      const promises = [];
      for (let i = 0; i < 150; i++) {
        promises.push(
          request(app.getHttpServer())
            .get('/users/profile')
            .set('Authorization', `Bearer ${authToken}`),
        );
      }

      const results = await Promise.all(promises);
      const rateLimited = results.some((res) => res.status === 429);

      expect(rateLimited).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(app.getHttpServer())
        .get('/non-existent-endpoint')
        .expect(404);
    });

    it('should return 400 for invalid request body', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalidField: 'test' })
        .expect(400);
    });

    it('should handle internal server errors gracefully', async () => {
      // Force an internal error by mocking a database failure
      mockUsersModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const response = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('statusCode', 500);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty(
        'x-content-type-options',
        'nosniff',
      );
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty(
        'x-xss-protection',
        '1; mode=block',
      );
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', () => {
      return request(app.getHttpServer())
        .options('/users/profile')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'GET')
        .expect(200);
    });
  });
});
