import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom, of } from 'rxjs';
import { UnauthorizedException } from '@nestjs/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import {
  AUTH_SERVICE_NAME,
  AuthServiceClient,
  AuthTokenPayload,
  Role,
  User,
} from '@bitsacco/common';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let jwtService: JwtService;
  let authService: Partial<AuthServiceClient>;

  const mockUser: User = {
    id: 'test-user-id',
    phone: {
      number: '+1234567890',
      verified: false,
    },
    roles: [Role.Member, Role.Admin],
  };

  const mockAccessToken = 'access-token-123';
  const mockRefreshToken = 'refresh-token-456';

  const mockTokenPayload: AuthTokenPayload = {
    user: mockUser,
    expires: new Date(Date.now() + 3600 * 1000), // 1 hour from now
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock for AuthServiceClient
    authService = {
      loginUser: jest.fn().mockReturnValue(
        of({
          user: mockUser,
          token: mockAccessToken,
          refreshToken: mockRefreshToken,
        }),
      ),
      registerUser: jest.fn().mockReturnValue(of({ user: mockUser })),
      verifyUser: jest.fn().mockReturnValue(
        of({
          user: mockUser,
          token: mockAccessToken,
          refreshToken: mockRefreshToken,
        }),
      ),
      authenticate: jest.fn().mockReturnValue(
        of({
          user: mockUser,
          token: mockAccessToken,
        }),
      ),
      recoverUser: jest.fn().mockReturnValue(of({ user: mockUser })),
      refreshToken: jest.fn().mockReturnValue(
        of({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
        }),
      ),
      revokeToken: jest.fn().mockReturnValue(of({ success: true })),
    };

    // Mock JWT service to decode tokens
    const mockJwtService = {
      decode: jest.fn().mockImplementation(() => mockTokenPayload),
    };

    // Mock gRPC client
    const mockGrpcClient = {
      getService: jest.fn().mockReturnValue(authService),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [AuthController],
      providers: [
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AUTH_SERVICE_NAME,
          useValue: mockGrpcClient,
        },
      ],
    });

    controller = module.get<AuthController>(AuthController);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should set auth cookies and return user with authentication status', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const loginRequest = {
        phone: '+1234567890',
        pin: '1234',
      };

      const result = await controller.login(loginRequest, mockResponse as any);

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
      });

      expect(authService.loginUser).toHaveBeenCalledWith(loginRequest);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'Authentication',
        mockAccessToken,
        expect.objectContaining({
          httpOnly: true,
        }),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'RefreshToken',
        mockRefreshToken,
        expect.objectContaining({
          httpOnly: true,
          path: '/auth/refresh',
        }),
      );
    });
  });

  describe('register', () => {
    it('should call authService.registerUser and return the result', async () => {
      const registerRequest = {
        name: 'Test User',
        phone: '+1234567890',
        pin: '123456',
        roles: [Role.Member],
      };

      const result = await firstValueFrom(controller.register(registerRequest));

      expect(result).toEqual({
        user: mockUser,
      });

      expect(authService.registerUser).toHaveBeenCalledWith(registerRequest);
    });
  });

  describe('verify', () => {
    it('should set auth cookies and return user with authentication status', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const verifyRequest = {
        phone: '+1234567890',
        otp: '123456',
      };

      const result = await controller.verify(
        verifyRequest,
        mockResponse as any,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
      });

      expect(authService.verifyUser).toHaveBeenCalledWith(verifyRequest);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('authenticate', () => {
    it('should set auth cookies and return user with authentication status', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const authRequest = {
        token: 'valid-token',
      };

      const result = await controller.authenticate(
        authRequest,
        mockResponse as any,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
      });

      expect(authService.authenticate).toHaveBeenCalledWith(authRequest);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(1); // Only access token, no refresh token
    });
  });

  describe('refresh', () => {
    it('should refresh tokens and set new cookies', async () => {
      const mockRequest = {
        cookies: {
          RefreshToken: mockRefreshToken,
        },
      };

      const mockResponse = {
        cookie: jest.fn(),
      };

      const result = await controller.refresh(
        mockRequest as any,
        mockResponse as any,
      );

      expect(result).toEqual({
        success: true,
        message: 'Tokens refreshed successfully',
      });

      expect(authService.refreshToken).toHaveBeenCalledWith({
        refreshToken: mockRefreshToken,
      });

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'Authentication',
        mockAccessToken,
        expect.any(Object),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'RefreshToken',
        mockRefreshToken,
        expect.any(Object),
      );
    });

    it('should throw UnauthorizedException when no refresh token is provided', async () => {
      const mockRequest = {
        cookies: {},
      };

      const mockResponse = {
        cookie: jest.fn(),
      };

      await expect(
        controller.refresh(mockRequest as any, mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.refreshToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke token and clear cookies', async () => {
      const mockRequest = {
        cookies: {
          RefreshToken: mockRefreshToken,
        },
      };

      const mockResponse = {
        clearCookie: jest.fn(),
      };

      const result = await controller.logout(
        mockRequest as any,
        mockResponse as any,
      );

      expect(result).toEqual({
        success: true,
        message: 'Logged out successfully',
      });

      expect(authService.revokeToken).toHaveBeenCalledWith({
        refreshToken: mockRefreshToken,
      });

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('Authentication');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('RefreshToken');
    });

    it('should clear cookies even if no refresh token is provided', async () => {
      const mockRequest = {
        cookies: {},
      };

      const mockResponse = {
        clearCookie: jest.fn(),
      };

      const result = await controller.logout(
        mockRequest as any,
        mockResponse as any,
      );

      expect(result).toEqual({
        success: true,
        message: 'Logged out successfully',
      });

      expect(authService.revokeToken).not.toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('setAuthCookies', () => {
    it('should not set cookies when token is not present', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const authResponse = of({
        user: mockUser,
      });

      // Use the private method via any type cast for testing
      const result = await (controller as any).setAuthCookies(
        authResponse,
        mockResponse,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: false,
      });

      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });
  });
});
