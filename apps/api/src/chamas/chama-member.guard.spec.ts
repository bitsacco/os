import { Test, TestingModule } from '@nestjs/testing';
import { ChamaMemberGuard } from './chama-member.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Role, CHAMAS_SERVICE_NAME } from '@bitsacco/common';
import { of } from 'rxjs';

describe('ChamaMemberGuard', () => {
  let guard: ChamaMemberGuard;
  let reflector: Reflector;
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
        ChamaMemberGuard,
        Reflector,
        {
          provide: CHAMAS_SERVICE_NAME,
          useValue: mockClientGrpc,
        },
      ],
    }).compile();

    guard = module.get<ChamaMemberGuard>(ChamaMemberGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockExecutionContext: Partial<ExecutionContext>;

    beforeEach(() => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { id: 'user-id' },
            params: { chamaId: 'chama-id' },
            query: {},
            body: {},
          }),
        }),
        getHandler: jest.fn(),
      };

      // Mock chamaIdField config
      jest.spyOn(reflector, 'get').mockReturnValue({ chamaIdField: 'chamaId' });
    });

    it('should allow access if no membership config is defined', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException if user is not authenticated', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          params: { chamaId: 'chama-id' },
          query: {},
          body: {},
        }),
      });

      await expect(
        guard.canActivate(mockExecutionContext as ExecutionContext),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should allow access if user is an Admin', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { id: 'user-id', roles: [Role.Admin] },
          params: { chamaId: 'chama-id' },
          query: {},
          body: {},
        }),
      });

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      expect(mockChamaService.findChama).not.toHaveBeenCalled();
    });

    it('should allow access if user is a SuperAdmin', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { id: 'user-id', roles: [Role.SuperAdmin] },
          params: { chamaId: 'chama-id' },
          query: {},
          body: {},
        }),
      });

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      expect(mockChamaService.findChama).not.toHaveBeenCalled();
    });

    it('should return false if chamaId param is not found', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { id: 'user-id' },
          params: {},
          query: {},
          body: {},
        }),
      });

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
      expect(mockChamaService.findChama).not.toHaveBeenCalled();
    });

    it('should allow access if user is a member of the chama', async () => {
      mockChamaService.findChama.mockReturnValue(
        of({
          id: 'chama-id',
          name: 'Test Chama',
          members: [{ userId: 'user-id', roles: [1] }],
        }),
      );

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
      expect(mockChamaService.findChama).toHaveBeenCalledWith({
        chamaId: 'chama-id',
      });
    });

    it('should deny access if user is not a member of the chama', async () => {
      mockChamaService.findChama.mockReturnValue(
        of({
          id: 'chama-id',
          name: 'Test Chama',
          members: [{ userId: 'other-user-id', roles: [1] }],
        }),
      );

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
      expect(mockChamaService.findChama).toHaveBeenCalledWith({
        chamaId: 'chama-id',
      });
    });

    it('should return false if error occurs during membership check', async () => {
      mockChamaService.findChama.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
      expect(mockChamaService.findChama).toHaveBeenCalledWith({
        chamaId: 'chama-id',
      });
    });
  });
});
