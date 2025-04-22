import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { ConfigService } from '@nestjs/config';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { JwtAuthGuard, ApiKeyGuard } from '@bitsacco/common';
import { Reflector } from '@nestjs/core';

describe('HealthController', () => {
  let controller: HealthController;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'APP_VERSION') return '0.0.1-test';
              return defaultValue;
            }),
          },
        },
        {
          provide: CombinedAuthGuard,
          useClass: MockCombinedAuthGuard,
        },
        {
          provide: JwtAuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: ApiKeyGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health information', () => {
      const result = controller.getHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service', 'api-gateway');
      expect(result).toHaveProperty('environment', 'test');
      expect(result).toHaveProperty('version', '0.0.1-test');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
    });
  });

  describe('getReadiness', () => {
    it('should return readiness information', () => {
      const result = controller.getReadiness();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty(
        'message',
        'API Gateway is ready to accept connections',
      );
    });
  });

  describe('getLiveness', () => {
    it('should return liveness information', () => {
      const result = controller.getLiveness();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('message', 'API Gateway is alive');
    });
  });

  describe('getPublicHealth', () => {
    it('should return public health information', () => {
      const result = controller.getPublicHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service', 'api-gateway');
      expect(result).toHaveProperty('environment', 'test');
      expect(result).toHaveProperty(
        'message',
        'This is a public health endpoint that does not require authentication',
      );
    });
  });
});

// Mock implementation of CombinedAuthGuard for testing
class MockCombinedAuthGuard {
  canActivate() {
    return true;
  }
}
