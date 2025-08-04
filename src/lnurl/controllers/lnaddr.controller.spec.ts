import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'bun:test';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { LightningAddressController } from './lnaddr.controller';
import { LightningAddressService } from '../services/lightning-address.service';
import { JwtAuthGuard } from '../../common/auth/jwt.auth';
import { CreateLightningAddressDto, UpdateLightningAddressDto } from '../dto';
import { AddressType } from '../../common/types/lnurl';
import {
  createMockFunction,
  createCommonMocks,
  createMockUser,
} from '../test-utils';

describe('LightningAddressController', () => {
  let controller: LightningAddressController;
  let lightningAddressService: any;

  const mockUser = createMockUser({ id: 'user123', _id: 'user123' });

  beforeEach(async () => {
    const { reflector, jwtService } = createCommonMocks();

    const mockLightningAddressService = {
      createAddress: createMockFunction(),
      listUserAddresses: createMockFunction(),
      getAddress: createMockFunction(),
      updateAddress: createMockFunction(),
      deleteAddress: createMockFunction(),
      getPaymentHistory: createMockFunction(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LightningAddressController],
      providers: [
        {
          provide: LightningAddressService,
          useValue: mockLightningAddressService,
        },
        { provide: JwtService, useValue: jwtService },
        { provide: Reflector, useValue: reflector },
        JwtAuthGuard,
      ],
    }).compile();

    controller = module.get<LightningAddressController>(
      LightningAddressController,
    );
    lightningAddressService = module.get(LightningAddressService);
  });

  describe('createAddress', () => {
    it('should create Lightning Address successfully', async () => {
      const req = { user: mockUser } as any;
      const createDto: CreateLightningAddressDto = {
        address: 'alice',
        type: AddressType.PERSONAL,
        metadata: {
          description: 'Alice Lightning Address',
          minSendable: 1000,
          maxSendable: 100000000,
        },
        settings: {
          enabled: true,
          allowComments: true,
          notifyOnPayment: true,
        },
      };

      const mockResponse = {
        _id: '507f1f77bcf86cd799439011',
        address: 'alice',
        domain: 'bitsacco.com',
        type: 'PERSONAL',
        ownerId: mockUser.id,
        metadata: createDto.metadata,
        settings: createDto.settings,
      };

      lightningAddressService.createAddress.mockResolvedValue(mockResponse);

      const result = await controller.createAddress(req, createDto);

      expect(lightningAddressService.createAddress.calls).toContainEqual([
        mockUser.id,
        createDto.address,
        createDto.type,
        createDto.metadata,
        createDto.settings,
      ]);
      expect(result).toEqual(mockResponse);
    });

    it('should use PERSONAL as default type when not provided', async () => {
      const req = { user: mockUser } as any;
      const createDto: CreateLightningAddressDto = {
        address: 'alice',
      };

      const mockResponse = {
        _id: '507f1f77bcf86cd799439011',
        address: 'alice',
        type: 'PERSONAL',
      };

      lightningAddressService.createAddress.mockResolvedValue(mockResponse);

      await controller.createAddress(req, createDto);

      expect(lightningAddressService.createAddress.calls).toContainEqual([
        mockUser.id,
        createDto.address,
        AddressType.PERSONAL,
        undefined,
        undefined,
      ]);
    });
  });

  describe('listMyAddresses', () => {
    it('should return user Lightning Addresses', async () => {
      const req = { user: mockUser } as any;
      const mockResponse = [
        {
          _id: '507f1f77bcf86cd799439011',
          address: 'alice',
          domain: 'bitsacco.com',
          type: 'PERSONAL',
          enabled: true,
        },
      ];

      lightningAddressService.listUserAddresses.mockResolvedValue(mockResponse);

      const result = await controller.listMyAddresses(req);

      expect(lightningAddressService.listUserAddresses.calls).toContainEqual([
        mockUser.id,
      ]);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getAddress', () => {
    it('should return Lightning Address details', async () => {
      const req = { user: mockUser } as any;
      const addressId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        _id: addressId,
        address: 'alice',
        domain: 'bitsacco.com',
        type: 'PERSONAL',
        metadata: {
          description: 'Alice Lightning Address',
          minSendable: 1000,
          maxSendable: 100000000,
        },
        settings: {
          enabled: true,
          allowComments: true,
          notifyOnPayment: true,
        },
      };

      lightningAddressService.getAddress.mockResolvedValue(mockResponse);

      const result = await controller.getAddress(req, addressId);

      expect(lightningAddressService.getAddress.calls).toContainEqual([
        addressId,
        mockUser.id,
      ]);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateAddress', () => {
    it('should update Lightning Address successfully', async () => {
      const req = { user: mockUser } as any;
      const addressId = '507f1f77bcf86cd799439011';
      const updateDto: UpdateLightningAddressDto = {
        metadata: {
          description: 'Updated Alice Lightning Address',
          maxSendable: 200000000,
        },
        settings: {
          customSuccessMessage: 'Payment received! Thank you.',
        },
      };

      const mockResponse = {
        _id: addressId,
        address: 'alice',
        metadata: {
          description: 'Updated Alice Lightning Address',
          minSendable: 1000,
          maxSendable: 200000000,
        },
        settings: {
          enabled: true,
          allowComments: true,
          notifyOnPayment: true,
          customSuccessMessage: 'Payment received! Thank you.',
        },
      };

      lightningAddressService.updateAddress.mockResolvedValue(mockResponse);

      const result = await controller.updateAddress(req, addressId, updateDto);

      expect(lightningAddressService.updateAddress.calls).toContainEqual([
        addressId,
        mockUser.id,
        updateDto,
      ]);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteAddress', () => {
    it('should delete Lightning Address successfully', async () => {
      const req = { user: mockUser } as any;
      const addressId = '507f1f77bcf86cd799439011';

      lightningAddressService.deleteAddress.mockResolvedValue(undefined);

      const result = await controller.deleteAddress(req, addressId);

      expect(lightningAddressService.deleteAddress.calls).toContainEqual([
        addressId,
        mockUser.id,
      ]);
      expect(result).toEqual({
        message: 'Lightning Address disabled successfully',
      });
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history with default pagination', async () => {
      const req = { user: mockUser } as any;
      const addressId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        payments: [
          {
            _id: '507f1f77bcf86cd799439013',
            type: 'PAY_IN',
            amount: 10000,
            status: 'completed',
            comment: 'Thanks for the coffee!',
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 1,
      };

      lightningAddressService.getPaymentHistory.mockResolvedValue(mockResponse);

      const result = await controller.getPaymentHistory(req, addressId);

      expect(lightningAddressService.getPaymentHistory.calls).toContainEqual([
        addressId,
        mockUser.id,
        20,
        0,
      ]);
      expect(result).toEqual(mockResponse);
    });

    it('should return payment history with custom pagination', async () => {
      const req = { user: mockUser } as any;
      const addressId = '507f1f77bcf86cd799439011';
      const limit = 10;
      const offset = 5;
      const mockResponse = {
        payments: [],
        total: 0,
      };

      lightningAddressService.getPaymentHistory.mockResolvedValue(mockResponse);

      const result = await controller.getPaymentHistory(
        req,
        addressId,
        limit,
        offset,
      );

      expect(lightningAddressService.getPaymentHistory.calls).toContainEqual([
        addressId,
        mockUser.id,
        limit,
        offset,
      ]);
      expect(result).toEqual(mockResponse);
    });
  });
});
