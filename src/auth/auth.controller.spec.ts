import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
  AuthTokenPayload,
  RecoverUserRequestDto,
  Role,
  User,
  VerifyUserRequestDto,
  getAccessToken,
} from '../common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<AuthService>;

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
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000),
    iss: 'test-issuer',
    aud: 'test-audience',
    jti: 'test-jti',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock getAccessToken for test cases that need it
    jest.spyOn({ getAccessToken }, 'getAccessToken');

    // Create mock for AuthService
    authService = {
      loginUser: jest.fn().mockResolvedValue({
        user: mockUser,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      }),
      registerUser: jest.fn().mockResolvedValue({ user: mockUser }),
      verifyUser: jest.fn().mockResolvedValue({
        user: mockUser,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      }),
      authenticate: jest.fn().mockResolvedValue({
        user: mockUser,
        accessToken: mockAccessToken,
      }),
      recoverUser: jest.fn().mockResolvedValue({
        user: mockUser,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      }),
      refreshToken: jest.fn().mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      }),
      revokeToken: jest.fn().mockResolvedValue(true),
    };

    // Mock JWT service to decode tokens
    const mockJwtService = {
      decode: jest.fn().mockImplementation(() => ({
        ...mockTokenPayload,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now in seconds
      })),
      options: {},
      logger: {},
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as JwtService;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should set auth cookies and return tokens in the response', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const loginRequest = {
        phone: '+1234567890',
        pin: '1234',
      };

      const request = {
        headers: {},
      };

      const result = await controller.login(
        request as any,
        loginRequest,
        mockResponse as any,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      expect(authService.loginUser).toHaveBeenCalledWith(loginRequest);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'Authentication',
        mockAccessToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
        }),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'RefreshToken',
        mockRefreshToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
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

      const result = await controller.register(registerRequest);

      expect(result).toEqual({
        user: mockUser,
      });

      expect(authService.registerUser).toHaveBeenCalledWith(registerRequest);
    });
  });

  describe('verify', () => {
    it('should set auth cookies and return tokens in the response', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const verifyRequest: VerifyUserRequestDto = {
        phone: '+1234567890',
        otp: '123456',
      };

      const request = {
        headers: {},
      };

      const result = await controller.verify(
        request as any,
        verifyRequest,
        mockResponse as any,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      expect(authService.verifyUser).toHaveBeenCalledWith(verifyRequest);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'Authentication',
        mockAccessToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
        }),
      );
    });
  });

  describe('recover', () => {
    it('should set auth cookies and return tokens in the response', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const recoverRequest: RecoverUserRequestDto = {
        phone: '+1234567890',
        pin: '123456',
      };

      const request = {
        headers: {},
      };

      const result = await controller.recover(
        request as any,
        recoverRequest,
        mockResponse as any,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      expect(authService.recoverUser).toHaveBeenCalledWith(recoverRequest);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'Authentication',
        mockAccessToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
        }),
      );
    });
  });

  describe('authenticate', () => {
    it('should set auth cookies and return tokens in the response', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const authRequest = {
        cookies: { Authentication: mockAccessToken },
        headers: {},
      };

      // Mock getAccessToken to return the token from cookies
      jest
        .spyOn({ getAccessToken }, 'getAccessToken')
        .mockReturnValueOnce(mockAccessToken);

      const result = await controller.authenticate(
        authRequest as any,
        mockResponse as any,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
        accessToken: mockAccessToken,
      });

      expect(authService.authenticate).toHaveBeenCalledWith({
        accessToken: mockAccessToken,
      });
      expect(mockResponse.cookie).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when no access token is provided', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const authRequest = {
        cookies: {},
        headers: {},
      };

      // Mock getAccessToken to return null (no token found)
      jest
        .spyOn({ getAccessToken }, 'getAccessToken')
        .mockReturnValueOnce(null);

      await expect(
        controller.authenticate(authRequest as any, mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.authenticate).not.toHaveBeenCalled();
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

      expect(authService.refreshToken).toHaveBeenCalledWith(mockRefreshToken);

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

      expect(authService.revokeToken).toHaveBeenCalledWith(mockRefreshToken);

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

      const authResponse = {
        user: mockUser,
      };

      // Use the private method via any type cast for testing
      const result = await (controller as any).setAuthCookies(
        authResponse,
        {} as any,
        mockResponse,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: false,
      });

      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it('should set cookies and return tokens in the response', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const authResponse = {
        user: mockUser,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      };

      const request = {
        headers: {},
      };

      // Use the private method via any type cast for testing
      const result = await (controller as any).setAuthCookies(
        authResponse,
        request as any,
        mockResponse,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });
  });
});
