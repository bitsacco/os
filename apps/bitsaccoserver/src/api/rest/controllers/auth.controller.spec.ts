import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from '../../../domains/auth/services/auth.service';
import { TestModuleBuilder } from '../../../../test/utils/test-module';
import {
  MockBusinessMetricsService,
  MockTelemetryService,
} from '../../../../test/mocks/external-services.mock';
import { BusinessMetricsService } from '../../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../infrastructure/monitoring/telemetry.service';

describe('AuthController (Integration)', () => {
  let app: INestApplication;
  let authService: Partial<AuthService>;

  const mockUser = {
    _id: 'test-user-id',
    phone: '+254700000000',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    status: 'active',
  };

  const mockAuthResult = {
    user: mockUser,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  };

  beforeEach(async () => {
    authService = {
      register: mock(),
      login: mock(),
      refreshToken: mock(),
      logout: mock(),
      validateUser: mock(),
    };

    const moduleRef = await TestModuleBuilder.create()
      .withConfig()
      .withControllers([AuthController])
      .withProviders([
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: BusinessMetricsService,
          useClass: MockBusinessMetricsService,
        },
        {
          provide: TelemetryService,
          useClass: MockTelemetryService,
        },
      ])
      .compileAndInit();

    app = moduleRef.createNestApplication();

    // Apply global validation pipe
    app.useGlobalPipes(
      new (await import('@nestjs/common')).ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    const validRegisterData = {
      phone: '+254700000000',
      name: 'Test User',
      email: 'test@example.com',
    };

    it('should register a new user successfully', async () => {
      authService.register?.mockResolvedValue(mockAuthResult);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegisterData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAuthResult);
      expect(authService.register).toHaveBeenCalledWith(validRegisterData);
    });

    it('should return 400 for invalid phone number', async () => {
      const invalidData = {
        ...validRegisterData,
        phone: 'invalid-phone',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        phone: '+254700000000',
        // missing name
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      authService.register?.mockRejectedValue(
        new Error('User already exists'),
      );

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegisterData)
        .expect(500);

      expect(authService.register).toHaveBeenCalled();
    });

    it('should include Nostr public key if provided', async () => {
      const dataWithNostr = {
        ...validRegisterData,
        npub: 'npub1test1234567890abcdef',
      };

      authService.register?.mockResolvedValue(mockAuthResult);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(dataWithNostr)
        .expect(201);

      expect(authService.register).toHaveBeenCalledWith(dataWithNostr);
    });
  });

  describe('POST /auth/login', () => {
    const validLoginData = {
      phone: '+254700000000',
      otp: '123456',
    };

    it('should login user successfully', async () => {
      authService.login?.mockResolvedValue(mockAuthResult);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAuthResult);
      expect(authService.login).toHaveBeenCalledWith(validLoginData);
    });

    it('should return 401 for invalid credentials', async () => {
      authService.login?.mockRejectedValue(
        new (await import('@nestjs/common')).UnauthorizedException(
          'Invalid credentials',
        ),
      );

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(authService.login).toHaveBeenCalled();
    });

    it('should accept login with password instead of OTP', async () => {
      const passwordLoginData = {
        phone: '+254700000000',
        password: 'password123',
      };

      authService.login?.mockResolvedValue(mockAuthResult);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(passwordLoginData)
        .expect(200);

      expect(authService.login).toHaveBeenCalledWith(passwordLoginData);
    });
  });

  describe('POST /auth/refresh', () => {
    const validRefreshData = {
      refreshToken: 'valid-refresh-token',
    };

    it('should refresh tokens successfully', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refreshToken?.mockResolvedValue(newTokens);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(validRefreshData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(newTokens);
      expect(authService.refreshToken).toHaveBeenCalledWith(
        validRefreshData.refreshToken,
      );
    });

    it('should return 401 for invalid refresh token', async () => {
      authService.refreshToken?.mockRejectedValue(
        new (await import('@nestjs/common')).UnauthorizedException(
          'Invalid refresh token',
        ),
      );

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(validRefreshData)
        .expect(401);
    });

    it('should return 400 for missing refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400);

      expect(authService.refreshToken).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    const validLogoutData = {
      refreshToken: 'valid-refresh-token',
    };

    it('should logout user successfully', async () => {
      authService.logout?.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-access-token')
        .send(validLogoutData)
        .expect(204);

      expect(authService.logout).toHaveBeenCalledWith(
        validLogoutData.refreshToken,
      );
    });

    it('should return 401 for missing authorization', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send(validLogoutData)
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    it('should return user profile successfully', async () => {
      authService.validateUser?.mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer valid-access-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUser);
    });

    it('should return 401 for missing authorization', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });

    it('should return 401 for invalid token', async () => {
      authService.validateUser?.mockRejectedValue(
        new (await import('@nestjs/common')).UnauthorizedException(
          'Invalid token',
        ),
      );

      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /auth/send-otp', () => {
    const validOtpRequest = {
      phone: '+254700000000',
    };

    it('should send OTP successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send(validOtpRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('OTP sent successfully');
    });

    it('should return 400 for invalid phone number', async () => {
      const invalidRequest = {
        phone: 'invalid-phone',
      };

      await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send(invalidRequest)
        .expect(400);
    });

    it('should return 400 for missing phone number', async () => {
      await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/verify-otp', () => {
    const validVerifyRequest = {
      phone: '+254700000000',
      otp: '123456',
    };

    it('should verify OTP successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send(validVerifyRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('OTP verified successfully');
    });

    it('should return 400 for invalid OTP format', async () => {
      const invalidRequest = {
        phone: '+254700000000',
        otp: '12345', // too short
      };

      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send(invalidRequest)
        .expect(400);
    });

    it('should return 400 for missing fields', async () => {
      const incompleteRequest = {
        phone: '+254700000000',
        // missing otp
      };

      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send(incompleteRequest)
        .expect(400);
    });
  });

  describe('Response format', () => {
    it('should return consistent response format for successful requests', async () => {
      authService.register?.mockResolvedValue(mockAuthResult);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          phone: '+254700000000',
          name: 'Test User',
          email: 'test@example.com',
        });

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('timestamp');
      expect(response.body.metadata).toHaveProperty('requestId');
      expect(response.body.metadata).toHaveProperty('path');
      expect(response.body.metadata).toHaveProperty('method');
      expect(response.body.metadata).toHaveProperty('statusCode');
    });

    it('should include request ID in response headers', async () => {
      authService.register?.mockResolvedValue(mockAuthResult);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          phone: '+254700000000',
          name: 'Test User',
          email: 'test@example.com',
        });

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.body.metadata.requestId).toBe(
        response.headers['x-request-id'],
      );
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to registration endpoint', async () => {
      authService.register?.mockResolvedValue(mockAuthResult);

      const registerData = {
        phone: '+254700000000',
        name: 'Test User',
        email: 'test@example.com',
      };

      // Make requests up to the limit
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ ...registerData, phone: `+25470000000${i}` })
          .expect(201);
      }

      // Next request should be rate limited
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerData, phone: '+254700000003' })
        .expect(429);
    });
  });
});
