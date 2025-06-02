import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { TestAppModule } from '../utils/test-app.module';
import { TestDatabase } from '../utils/test-database';
import { TestDataFactory } from '../utils/test-module';

describe('Authentication (E2E)', () => {
  let app: INestApplication;
  let connection: Connection;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [TestAppModule],
      }).compile();

      app = moduleFixture.createNestApplication();

      // Set global prefix to match main application
      app.setGlobalPrefix('api/v1');

      try {
        connection = moduleFixture.get<Connection>(getConnectionToken());
      } catch (error) {
        console.warn('Could not get database connection:', error.message);
        connection = null;
      }

      await app.init();
      console.log('Test application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize test application:', error);
      // Set app to null so tests can detect initialization failure
      app = null;
      throw error;
    }
  });

  beforeEach(async () => {
    // Clear database before each test
    await TestDatabase.clearDatabase(connection);
  });

  afterAll(async () => {
    if (connection) {
      await TestDatabase.clearDatabase(connection);
    }
    if (app) {
      await app.close();
    }
  });

  describe('User Registration Flow', () => {
    it('should complete full registration flow', async () => {
      const userData = {
        phone: '+254700000000',
        name: 'John Doe',
        email: 'john@example.com',
      };

      // 1. Register user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data).toHaveProperty('user');
      expect(registerResponse.body.data).toHaveProperty('accessToken');
      expect(registerResponse.body.data).toHaveProperty('refreshToken');
      expect(registerResponse.body.data.user.phone).toBe(userData.phone);
      expect(registerResponse.body.data.user.name).toBe(userData.name);
      expect(registerResponse.body.data.user.email).toBe(userData.email);

      const { accessToken, refreshToken } = registerResponse.body.data;

      // 2. Get user profile
      const profileResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.phone).toBe(userData.phone);

      // 3. Refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data).toHaveProperty('accessToken');
      expect(refreshResponse.body.data).toHaveProperty('refreshToken');

      const newAccessToken = refreshResponse.body.data.accessToken;
      const newRefreshToken = refreshResponse.body.data.refreshToken;

      // 4. Verify new tokens work
      await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // 5. Logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .send({ refreshToken: newRefreshToken })
        .expect(204);

      // 6. Verify old tokens don't work after logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(401);
    });

    it('should prevent duplicate registrations', async () => {
      const userData = {
        phone: '+254700000001',
        name: 'Jane Doe',
        email: 'jane@example.com',
      };

      // First registration should succeed
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same phone should fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...userData, name: 'Different Name' })
        .expect(400);
    });
  });

  describe('User Login Flow', () => {
    let existingUser: any;

    beforeEach(async () => {
      // Create a user for login tests
      const userData = {
        phone: '+254700000002',
        name: 'Login User',
        email: 'login@example.com',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userData);

      existingUser = registerResponse.body.data.user;
    });

    it('should complete login flow with OTP', async () => {
      // In test environment, any 6-digit OTP should work
      const loginData = {
        phone: existingUser.phone,
        otp: '123456',
      };

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data).toHaveProperty('user');
      expect(loginResponse.body.data).toHaveProperty('accessToken');
      expect(loginResponse.body.data).toHaveProperty('refreshToken');
      expect(loginResponse.body.data.user.phone).toBe(existingUser.phone);
    });

    it('should reject login with invalid phone', async () => {
      const loginData = {
        phone: '+254700000999', // Non-existent phone
        otp: '123456',
      };

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should reject login with invalid OTP format', async () => {
      const loginData = {
        phone: existingUser.phone,
        otp: '12345', // Invalid format
      };

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);
    });
  });

  describe('Token Management', () => {
    let userTokens: any;

    beforeEach(async () => {
      const userData = {
        phone: '+254700000003',
        name: 'Token User',
        email: 'token@example.com',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userData);

      userTokens = registerResponse.body.data;
    });

    it('should refresh tokens multiple times', async () => {
      let currentRefreshToken = userTokens.refreshToken;

      // Refresh tokens 3 times
      for (let i = 0; i < 3; i++) {
        const refreshResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: currentRefreshToken })
          .expect(200);

        expect(refreshResponse.body.data).toHaveProperty('accessToken');
        expect(refreshResponse.body.data).toHaveProperty('refreshToken');

        // Update for next iteration
        currentRefreshToken = refreshResponse.body.data.refreshToken;

        // Verify new access token works
        await request(app.getHttpServer())
          .get('/api/v1/auth/profile')
          .set(
            'Authorization',
            `Bearer ${refreshResponse.body.data.accessToken}`,
          )
          .expect(200);
      }
    });

    it('should invalidate old refresh tokens after refresh', async () => {
      const originalRefreshToken = userTokens.refreshToken;

      // Refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: originalRefreshToken })
        .expect(200);

      const newRefreshToken = refreshResponse.body.data.refreshToken;

      // Old refresh token should no longer work
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: originalRefreshToken })
        .expect(401);

      // New refresh token should still work
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(200);
    });
  });

  describe('OTP Management', () => {
    it('should send OTP for valid phone number', async () => {
      const otpRequest = {
        phone: '+254700000004',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send(otpRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('OTP sent successfully');
    });

    it('should verify OTP correctly', async () => {
      const verifyRequest = {
        phone: '+254700000005',
        otp: '123456',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send(verifyRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('OTP verified successfully');
    });

    it('should handle rate limiting for OTP requests', async () => {
      const otpRequest = {
        phone: '+254700000006',
      };

      // Send 3 OTP requests (should hit rate limit)
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/send-otp')
          .send(otpRequest)
          .expect(200);
      }

      // 4th request should be rate limited
      await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send(otpRequest)
        .expect(429);
    });
  });

  describe('Security and Validation', () => {
    it('should validate phone number format', async () => {
      const invalidPhones = [
        'invalid-phone',
        '254700000000', // Missing +
        '+1234', // Too short
        '+254-700-000-000', // Invalid format
      ];

      for (const phone of invalidPhones) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            phone,
            name: 'Test User',
            email: 'test@example.com',
          })
          .expect(400);
      }
    });

    it('should validate email format when provided', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test..email@example.com',
      ];

      for (const email of invalidEmails) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            phone: '+254700000007',
            name: 'Test User',
            email,
          })
          .expect(400);
      }
    });

    it('should sanitize user data in responses', async () => {
      const userData = {
        phone: '+254700000008',
        name: 'Security Test',
        email: 'security@example.com',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userData);

      // Password field should not be present in response
      expect(registerResponse.body.data.user).not.toHaveProperty('password');
      expect(registerResponse.body.data.user).not.toHaveProperty(
        'hashedPassword',
      );
    });

    it('should require authorization for protected endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'some-token' })
        .expect(401);
    });

    it('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'Invalid Header',
        'Bearer', // Missing token
        'Basic dGVzdA==', // Wrong type
        'Bearer invalid.token.format',
      ];

      for (const header of malformedHeaders) {
        await request(app.getHttpServer())
          .get('/api/v1/auth/profile')
          .set('Authorization', header)
          .expect(401);
      }
    });
  });
});
