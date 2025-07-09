import { Test, TestingModule } from '@nestjs/testing';
import { ChamaBulkAccessGuard } from './chama-bulk-access.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Role } from '@bitsacco/common';
import { ChamasService } from './chamas.service';

describe('ChamaBulkAccessGuard', () => {
  let guard: ChamaBulkAccessGuard;
  let reflector: Reflector;
  let mockChamaService: any;

  beforeEach(async () => {
    mockChamaService = {
      findChama: jest.fn(),
      filterChamas: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChamaBulkAccessGuard,
        {
          provide: ChamasService,
          useValue: mockChamaService,
        },
      ],
    }).compile();

    guard = module.get<ChamaBulkAccessGuard>(ChamaBulkAccessGuard);
    reflector = module.get<Reflector>(Reflector);
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
        body: {
          chamaIds: ['chama-1', 'chama-2'],
        },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      };
    });

    it('should throw UnauthorizedException if user is not authenticated', async () => {
      mockRequest.user = null;

      await expect(
        guard.canActivate(mockExecutionContext as ExecutionContext),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should allow access if user is an Admin', async () => {
      mockRequest.user.roles = [Role.Admin];

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      expect(mockChamaService.findChama).not.toHaveBeenCalled();
    });

    it('should allow access if user is a SuperAdmin', async () => {
      mockRequest.user.roles = [Role.SuperAdmin];

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      expect(mockChamaService.findChama).not.toHaveBeenCalled();
    });

    it('should auto-populate chamaIds if empty and user is a member of some chamas', async () => {
      mockRequest.body.chamaIds = [];

      // Setup mock to return user's chama memberships
      mockChamaService.filterChamas.mockResolvedValue({
        chamas: [
          {
            id: 'chama-3',
            name: 'Test Chama 3',
            members: [{ userId: 'user-id' }],
          },
          {
            id: 'chama-4',
            name: 'Test Chama 4',
            members: [{ userId: 'user-id' }],
          },
        ],
        page: 0,
        size: 0,
        pages: 1,
        total: 2,
      });

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      expect(mockChamaService.filterChamas).toHaveBeenCalledWith({
        memberId: 'user-id',
        pagination: {
          page: 0,
          size: 0,
        },
      });
      expect(mockRequest.body.chamaIds).toEqual(['chama-3', 'chama-4']);
    });

    it('should auto-populate chamaIds if not provided and user is a member of some chamas', async () => {
      mockRequest.body = {};

      // Setup mock to return user's chama memberships
      mockChamaService.filterChamas.mockResolvedValue({
        chamas: [
          {
            id: 'chama-3',
            name: 'Test Chama 3',
            members: [{ userId: 'user-id' }],
          },
          {
            id: 'chama-4',
            name: 'Test Chama 4',
            members: [{ userId: 'user-id' }],
          },
        ],
        page: 0,
        size: 0,
        pages: 1,
        total: 2,
      });

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      expect(mockChamaService.filterChamas).toHaveBeenCalledWith({
        memberId: 'user-id',
        pagination: {
          page: 0,
          size: 0,
        },
      });
      expect(mockRequest.body.chamaIds).toEqual(['chama-3', 'chama-4']);
    });

    it('should allow access if user is a member of all requested chamas', async () => {
      // Setup mock to return user's chama memberships
      mockChamaService.filterChamas.mockResolvedValue({
        chamas: [
          {
            id: 'chama-1',
            name: 'Test Chama 1',
            members: [{ userId: 'user-id' }],
          },
          {
            id: 'chama-2',
            name: 'Test Chama 2',
            members: [{ userId: 'user-id' }],
          },
          {
            id: 'chama-3',
            name: 'Test Chama 3',
            members: [{ userId: 'user-id' }],
          },
        ],
        page: 0,
        size: 0,
        pages: 1,
        total: 3,
      });

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      expect(mockChamaService.filterChamas).toHaveBeenCalledWith({
        memberId: 'user-id',
        pagination: {
          page: 0,
          size: 0,
        },
      });
      // Original chamaIds should be preserved
      expect(mockRequest.body.chamaIds).toEqual(['chama-1', 'chama-2']);
    });

    it('should deny access if user is not a member of all requested chamas', async () => {
      // Setup mock to return user's chama memberships (missing chama-2)
      mockChamaService.filterChamas.mockResolvedValue({
        chamas: [
          {
            id: 'chama-1',
            name: 'Test Chama 1',
            members: [{ userId: 'user-id' }],
          },
          {
            id: 'chama-3',
            name: 'Test Chama 3',
            members: [{ userId: 'user-id' }],
          },
        ],
        page: 0,
        size: 0,
        pages: 1,
        total: 2,
      });

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
      expect(mockChamaService.filterChamas).toHaveBeenCalledWith({
        memberId: 'user-id',
        pagination: {
          page: 0,
          size: 0,
        },
      });
    });

    it('should return false if error occurs during membership check', async () => {
      mockChamaService.filterChamas.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
      expect(mockChamaService.filterChamas).toHaveBeenCalledWith({
        memberId: 'user-id',
        pagination: {
          page: 0,
          size: 0,
        },
      });
    });
  });
});
