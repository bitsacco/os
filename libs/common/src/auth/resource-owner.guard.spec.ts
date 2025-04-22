import { Test } from '@nestjs/testing';
import { ResourceOwnerGuard } from './resource-owner.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types';

describe('ResourceOwnerGuard', () => {
  let resourceOwnerGuard: ResourceOwnerGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResourceOwnerGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    resourceOwnerGuard = moduleRef.get<ResourceOwnerGuard>(ResourceOwnerGuard);
    reflector = moduleRef.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(resourceOwnerGuard).toBeDefined();
  });

  it('should return true if no ownership metadata', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
      getHandler: () => ({}),
    } as ExecutionContext;

    const result = await resourceOwnerGuard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException if user is not authenticated', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ paramName: 'id' });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
      getHandler: () => ({}),
    } as ExecutionContext;

    await expect(resourceOwnerGuard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should return true if resourceId is not present', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ paramName: 'id' });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { _id: '123' },
          params: {},
        }),
      }),
      getHandler: () => ({}),
    } as ExecutionContext;

    const result = await resourceOwnerGuard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should return true if user is admin', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ paramName: 'id' });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { _id: '123', roles: [Role.Admin] },
          params: { id: '456' },
        }),
      }),
      getHandler: () => ({}),
    } as ExecutionContext;

    const result = await resourceOwnerGuard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should return true if user is super admin', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ paramName: 'id' });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { _id: '123', roles: [Role.SuperAdmin] },
          params: { id: '456' },
        }),
      }),
      getHandler: () => ({}),
    } as ExecutionContext;

    const result = await resourceOwnerGuard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should return true if resource belongs to user', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ paramName: 'id' });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { _id: '123', roles: [Role.Member] },
          params: { id: '123' },
        }),
      }),
      getHandler: () => ({}),
    } as ExecutionContext;

    const result = await resourceOwnerGuard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should return false if resource does not belong to user', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ paramName: 'id' });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { _id: '123', roles: [Role.Member] },
          params: { id: '456' },
        }),
      }),
      getHandler: () => ({}),
    } as ExecutionContext;

    const result = await resourceOwnerGuard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should use custom idField if provided', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      paramName: 'id',
      idField: 'userId',
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: '123', roles: [Role.Member] },
          params: { id: '123' },
        }),
      }),
      getHandler: () => ({}),
    } as ExecutionContext;

    const result = await resourceOwnerGuard.canActivate(context);
    expect(result).toBe(true);
  });
});
