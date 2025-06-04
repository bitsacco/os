import { Test, TestingModule } from '@nestjs/testing';
import { ChamaFilterGuard } from './chama-filter.guard';
import { ExecutionContext } from '@nestjs/common';
import { Role, CHAMAS_SERVICE_NAME } from '@bitsacco/common';

describe('ChamaFilterGuard', () => {
  let guard: ChamaFilterGuard;
  let mockChamaService: any;

  beforeEach(async () => {
    mockChamaService = {
      findChama: jest.fn(),
    };

    const mockClientGrpc = {
      getService: jest.fn().mockReturnValue(mockChamaService),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChamaFilterGuard,
        {
          provide: CHAMAS_SERVICE_NAME,
          useValue: mockClientGrpc,
        },
      ],
    }).compile();

    guard = module.get<ChamaFilterGuard>(ChamaFilterGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockExecutionContext: Partial<ExecutionContext>;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        user: { id: 'user-id' },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      };
    });

    it('should allow admin users to filter all chamas', async () => {
      // Set the user as an admin
      mockRequest.user.roles = [Role.Admin];
      mockRequest.query = { memberId: 'other-user-id' };

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      // Admin should be able to specify any memberId
      expect(mockRequest.query.memberId).toBe('other-user-id');
    });

    it('should allow superadmin users to filter all chamas', async () => {
      // Set the user as a superadmin
      mockRequest.user.roles = [Role.SuperAdmin];
      mockRequest.query = { memberId: 'other-user-id' };

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      // SuperAdmin should be able to specify any memberId
      expect(mockRequest.query.memberId).toBe('other-user-id');
    });

    it('should set memberId to user.id if not provided', async () => {
      // Set a regular user with no memberId specified
      mockRequest.user.roles = [];
      mockRequest.query = {};

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      // memberId should be automatically set to user's own ID
      expect(mockRequest.query.memberId).toBe('user-id');
    });

    it('should return false if non-admin user tries to filter chamas by other user id', async () => {
      // Set a regular user
      mockRequest.user.roles = [];
      mockRequest.query = { memberId: 'other-user-id' };

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
    });

    it('should return false if user is not authenticated', async () => {
      mockRequest.user = null;

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
    });
  });
});
