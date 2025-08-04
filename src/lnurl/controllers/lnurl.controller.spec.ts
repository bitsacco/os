import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'bun:test';
import { BadRequestException } from '@nestjs/common';
import { LnurlController } from './lnurl.controller';
import { LightningAddressService } from '../services/lightning-address.service';
import { createMockFunction } from '../test-utils';

describe('LnurlController', () => {
  let controller: LnurlController;
  let lightningAddressService: any;

  beforeEach(async () => {
    const mockLightningAddressService = {
      generatePayResponse: createMockFunction(),
      processPaymentCallback: createMockFunction(),
      validateExternalAddress: createMockFunction(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LnurlController],
      providers: [
        {
          provide: LightningAddressService,
          useValue: mockLightningAddressService,
        },
      ],
    }).compile();

    controller = module.get<LnurlController>(LnurlController);
    lightningAddressService = module.get(LightningAddressService);
  });

  describe('getLnurlPay', () => {
    it('should return LNURL-pay metadata for valid address', async () => {
      const address = 'alice';
      const mockResponse = {
        callback: 'https://bitsacco.com/v1/lnurl/callback/alice',
        maxSendable: 100000000,
        minSendable: 1000,
        metadata: '[["text/plain","Pay to alice@bitsacco.com"]]',
        tag: 'payRequest',
      };

      lightningAddressService.generatePayResponse.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.getLnurlPay(address);

      expect(lightningAddressService.generatePayResponse.calls).toContainEqual([
        address,
      ]);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('lnurlCallback', () => {
    it('should process payment callback with valid parameters', async () => {
      const address = 'alice';
      const amount = '10000';
      const comment = 'Thanks for the coffee!';
      const mockResponse = {
        pr: 'lnbc500n1p3...',
        routes: [],
        successAction: {
          tag: 'message',
          message: 'Payment received! Thank you.',
        },
      };

      lightningAddressService.processPaymentCallback.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.lnurlCallback(address, amount, comment);

      expect(
        lightningAddressService.processPaymentCallback.calls,
      ).toContainEqual([address, 10000, { comment, nostr: undefined }]);
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException for invalid amount format', async () => {
      const address = 'alice';
      const invalidAmount = 'invalid';

      await expect(
        controller.lnurlCallback(address, invalidAmount),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.lnurlCallback(address, invalidAmount),
      ).rejects.toThrow(
        'Invalid amount format. Amount must be a numeric string representing millisatoshis',
      );
    });

    it('should throw BadRequestException for zero or negative amount', async () => {
      const address = 'alice';

      await expect(controller.lnurlCallback(address, '0')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.lnurlCallback(address, '-1000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should parse nostr parameter when provided', async () => {
      const address = 'alice';
      const amount = '10000';
      const nostrData = { pubkey: 'abc123', relay: 'wss://relay.example.com' };
      const nostrString = JSON.stringify(nostrData);
      const mockResponse = {
        pr: 'lnbc500n1p3...',
        routes: [],
      };

      lightningAddressService.processPaymentCallback.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.lnurlCallback(
        address,
        amount,
        undefined,
        nostrString,
      );

      expect(
        lightningAddressService.processPaymentCallback.calls,
      ).toContainEqual([
        address,
        10000,
        {
          comment: undefined,
          nostr: nostrData,
        },
      ]);
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException for invalid nostr JSON', async () => {
      const address = 'alice';
      const amount = '10000';
      const invalidNostr = 'invalid json';

      await expect(
        controller.lnurlCallback(address, amount, undefined, invalidNostr),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateAddress', () => {
    it('should validate external Lightning Address', async () => {
      const address = 'user@walletofsatoshi.com';
      const mockResponse = {
        valid: true,
        metadata: {
          callback: 'https://walletofsatoshi.com/.well-known/lnurlp/user',
          minSendable: 1000,
          maxSendable: 100000000000,
          metadata: '[["text/plain","Pay to user@walletofsatoshi.com"]]',
          tag: 'payRequest',
        },
      };

      lightningAddressService.validateExternalAddress.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.validateAddress(address);

      expect(
        lightningAddressService.validateExternalAddress.calls,
      ).toContainEqual([address]);
      expect(result).toEqual(mockResponse);
    });

    it('should return validation failure for invalid address', async () => {
      const address = 'invalid@nonexistent.com';
      const mockResponse = {
        valid: false,
        error: 'Lightning Address not found or unreachable',
      };

      lightningAddressService.validateExternalAddress.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.validateAddress(address);

      expect(result).toEqual(mockResponse);
    });
  });
});
