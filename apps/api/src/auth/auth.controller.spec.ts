import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom, of } from 'rxjs';
import { UnauthorizedException } from '@nestjs/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import {
  AUTH_SERVICE_NAME,
  AuthServiceClient,
  AuthTokenPayload,
  RecoverUserRequestDto,
  Role,
  User,
  VerifyUserRequestDto,
  getAccessToken,
} from '@bitsacco/common';
import { AuthController } from './auth.controller';
import Bowser from 'bowser';

describe('AuthController', () => {
  let controller: AuthController;
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

    // Mock getAccessToken for test cases that need it
    jest.spyOn({ getAccessToken }, 'getAccessToken');

    // Mock Bowser for isBrowserRequest checks
    jest.spyOn(Bowser, 'getParser').mockImplementation((userAgent) => {
      return {
        getBrowserName: () => {
          return userAgent?.includes('Chrome') ? 'Chrome' : undefined;
        }
      } as any;
    });

    // Create mock for AuthServiceClient
    authService = {
      loginUser: jest.fn().mockReturnValue(
        of({
          user: mockUser,
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
        }),
      ),
      registerUser: jest.fn().mockReturnValue(of({ user: mockUser })),
      verifyUser: jest.fn().mockReturnValue(
        of({
          user: mockUser,
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
        }),
      ),
      authenticate: jest.fn().mockReturnValue(
        of({
          user: mockUser,
          accessToken: mockAccessToken,
        }),
      ),
      recoverUser: jest.fn().mockReturnValue(
        of({
          user: mockUser,
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
        }),
      ),
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
      options: {},
      logger: {},
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as JwtService;

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
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should set auth cookies and return minimal response for browser clients', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const loginRequest = {
        phone: '+1234567890',
        pin: '1234',
      };

      const browserRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/96.0.4664.110 Safari/537.36',
        },
      };

      const result = await controller.login(
        browserRequest as any,
        loginRequest,
        mockResponse as any,
      );

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

    it('should return tokens in body for non-browser clients', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const loginRequest = {
        phone: '+1234567890',
        pin: '1234',
      };

      const nonBrowserRequest = {
        headers: {
          'user-agent': 'Mobile App',
        },
      };

      const result = await controller.login(
        nonBrowserRequest as any,
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
      expect(mockResponse.cookie).not.toHaveBeenCalled();
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

      const result = await firstValueFrom(
        controller.register({} as any, registerRequest),
      );

      expect(result).toEqual({
        user: mockUser,
      });

      expect(authService.registerUser).toHaveBeenCalledWith(registerRequest);
    });
  });

  describe('verify', () => {
    it('should set auth cookies for browser clients', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const verifyRequest: VerifyUserRequestDto = {
        phone: '+1234567890',
        otp: '123456',
      };

      const browserRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/96.0.4664.110 Safari/537.36',
        },
      };

      const result = await controller.verify(
        browserRequest as any,
        verifyRequest,
        mockResponse as any,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
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

    it('should return tokens in body for non-browser clients', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const verifyRequest: VerifyUserRequestDto = {
        phone: '+1234567890',
        otp: '123456',
      };

      const nonBrowserRequest = {
        headers: {
          'user-agent': 'Mobile App',
        },
      };

      const result = await controller.verify(
        nonBrowserRequest as any,
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
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });
  });

  describe('recover', () => {
    it('should set auth cookies for browser clients', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const recoverRequest: RecoverUserRequestDto = {
        phone: '+1234567890',
        pin: '123456',
      };

      const browserRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/96.0.4664.110 Safari/537.36',
        },
      };

      const result = await controller.recover(
        browserRequest as any,
        recoverRequest,
        mockResponse as any,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
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

    it('should return tokens in body for non-browser clients', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const recoverRequest: RecoverUserRequestDto = {
        phone: '+1234567890',
        pin: '123456',
      };

      const nonBrowserRequest = {
        headers: {
          'user-agent': 'Mobile App',
        },
      };

      const result = await controller.recover(
        nonBrowserRequest as any,
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
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });
  });

  describe('authenticate', () => {
    it('should set auth cookies and return user with authentication status when cookies are used', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const authRequest = {
        cookies: { Authentication: mockAccessToken },
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/96.0.4664.110 Safari/537.36',
        },
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
      });

      expect(authService.authenticate).toHaveBeenCalledWith({
        accessToken: mockAccessToken,
      });
      expect(mockResponse.cookie).toHaveBeenCalledTimes(1);
    });

    it('should return tokens in response body for non-browser clients', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const authRequest = {
        headers: {
          authorization: `Bearer ${mockAccessToken}`,
          'user-agent': 'Mobile App',
        },
      };

      // Mock getAccessToken to return the token from bearer auth
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
      expect(mockResponse.cookie).not.toHaveBeenCalled();
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
        {} as any,
        mockResponse,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: false,
      });

      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it('should set cookies for browser requests', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const authResponse = of({
        user: mockUser,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      const browserRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/96.0.4664.110 Safari/537.36',
        },
      };

      // Use the private method via any type cast for testing
      const result = await (controller as any).setAuthCookies(
        authResponse,
        browserRequest as any,
        mockResponse,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
      });

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('should return tokens for non-browser requests', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      };

      const authResponse = of({
        user: mockUser,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      const nonBrowserRequest = {
        headers: {
          'user-agent': 'Mobile App',
        },
      };

      // Use the private method via any type cast for testing
      const result = await (controller as any).setAuthCookies(
        authResponse,
        nonBrowserRequest as any,
        mockResponse,
      );

      expect(result).toEqual({
        user: mockUser,
        authenticated: true,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });
  });
});
