import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, JwtAuthStrategy } from '../common/auth/jwt.auth';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';

describe('SolowalletController', () => {
  let controller: SolowalletController;
  let mockSolowalletService: Partial<SolowalletService>;

  beforeEach(async () => {
    // Create mock for SolowalletService
    mockSolowalletService = {
      findTransaction: jest.fn().mockResolvedValue({}),
      depositFunds: jest.fn().mockResolvedValue({}),
      withdrawFunds: jest.fn().mockResolvedValue({}),
      userTransactions: jest.fn().mockResolvedValue({}),
      continueDepositFunds: jest.fn().mockResolvedValue({}),
      continueWithdrawFunds: jest.fn().mockResolvedValue({}),
      updateTransaction: jest.fn().mockResolvedValue({}),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('https://test.com/lnurl/callback'),
    };

    const jwtAuthMocks = [
      {
        provide: JwtService,
        useValue: {
          sign: jest.fn(),
          verify: jest.fn(),
          decode: jest.fn(),
        },
      },
      {
        provide: ConfigService,
        useValue: mockConfigService,
      },
      {
        provide: Reflector,
        useValue: {
          get: jest.fn(),
          getAllAndOverride: jest.fn(),
        },
      },
      {
        provide: JwtAuthStrategy,
        useValue: {
          validate: jest.fn(),
        },
      },
      {
        provide: JwtAuthGuard,
        useValue: {
          canActivate: jest.fn().mockReturnValue(true),
        },
      },
    ];

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SolowalletController],
      providers: [
        {
          provide: SolowalletService,
          useValue: mockSolowalletService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        ...jwtAuthMocks,
      ],
    }).compile();

    controller = module.get<SolowalletController>(SolowalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
