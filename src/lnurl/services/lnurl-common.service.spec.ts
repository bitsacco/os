import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LnurlCommonService } from './lnurl-common.service';
import { btcToFiat, fiatToBtc } from '../../common';

describe('LnurlCommonService', () => {
  let service: LnurlCommonService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LnurlCommonService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                LNURL_DOMAIN: 'bitsacco.com',
                LNURL_CALLBACK_BASE_URL: 'https://api.bitsacco.com',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LnurlCommonService>(LnurlCommonService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('LNURL encoding/decoding', () => {
    const testUrl =
      'https://api.bitsacco.com/v1/lnurl/withdraw/callback?k1=test123';

    it('should encode URL to LNURL', () => {
      const encoded = service.encodeLnurl(testUrl);
      expect(encoded).toBeTruthy();
      expect(encoded.startsWith('lnurl')).toBe(true);
      expect(encoded).toBe(encoded.toLowerCase());
    });

    it('should decode LNURL to URL', () => {
      const encoded = service.encodeLnurl(testUrl);
      const decoded = service.decodeLnurl(encoded);
      expect(decoded).toBe(testUrl);
    });

    it('should validate correct LNURL', () => {
      const encoded = service.encodeLnurl(testUrl);
      expect(service.validateLnurl(encoded)).toBe(true);
    });

    it('should reject invalid LNURL', () => {
      expect(service.validateLnurl('invalid')).toBe(false);
      expect(service.validateLnurl('')).toBe(false);
      expect(service.validateLnurl('lnurl')).toBe(false);
      // Should reject uppercase LNURL (bech32 must be lowercase)
      expect(
        service.validateLnurl(
          'LNURL1DP68GURN8GHJ7MRWW4EXCTNXD9SHG6NPVCHXXMMD9AKXUATJDSKHW6T5DPJ8YCTH8AEK2UMND9HKU0',
        ),
      ).toBe(false);
    });
  });

  describe('Lightning Address validation', () => {
    it('should validate correct Lightning addresses', () => {
      expect(service.isLightningAddress('alice@bitsacco.com')).toBe(true);
      expect(service.isLightningAddress('user.name@domain.co.ke')).toBe(true);
      expect(service.isLightningAddress('test_user@example.org')).toBe(true);
    });

    it('should reject invalid Lightning addresses', () => {
      expect(service.isLightningAddress('notanemail')).toBe(false);
      expect(service.isLightningAddress('@domain.com')).toBe(false);
      expect(service.isLightningAddress('user@')).toBe(false);
      expect(service.isLightningAddress('user@domain')).toBe(false);
      expect(service.isLightningAddress('')).toBe(false);
    });

    it('should parse Lightning address correctly', () => {
      const parsed = service.parseLightningAddress('alice@bitsacco.com');
      expect(parsed).toEqual({
        username: 'alice',
        domain: 'bitsacco.com',
      });
    });
  });

  describe('K1 generation', () => {
    it('should generate valid k1 values', () => {
      const k1 = service.generateK1();
      expect(k1).toBeTruthy();
      expect(k1.length).toBe(64); // 32 bytes as hex = 64 chars
      expect(/^[0-9a-f]+$/.test(k1)).toBe(true);
    });

    it('should generate unique k1 values', () => {
      const k1_1 = service.generateK1();
      const k1_2 = service.generateK1();
      expect(k1_1).not.toBe(k1_2);
    });
  });

  describe('Amount conversion', () => {
    const btcToKesRate = 5000000; // 1 BTC = 5M KES

    it('should convert fiat to millisatoshis', () => {
      const result1 = fiatToBtc({
        amountFiat: 100,
        btcToFiatRate: btcToKesRate,
      });
      expect(result1.amountMsats).toBe(2000000); // 100 KES = 2M msats

      const result2 = fiatToBtc({
        amountFiat: 1000,
        btcToFiatRate: btcToKesRate,
      });
      expect(result2.amountMsats).toBe(20000000); // 1000 KES = 20M msats
    });

    it('should convert millisatoshis to fiat', () => {
      const result1 = btcToFiat({
        amountMsats: 2000000,
        fiatToBtcRate: btcToKesRate,
      });
      expect(result1.amountFiat).toBeCloseTo(100, 2);

      const result2 = btcToFiat({
        amountMsats: 20000000,
        fiatToBtcRate: btcToKesRate,
      });
      expect(result2.amountFiat).toBeCloseTo(1000, 2);
    });
  });

  describe('Amount validation', () => {
    it('should validate amounts within range', () => {
      expect(service.validateAmount(5000, 1000, 10000)).toBe(true);
      expect(service.validateAmount(1000, 1000, 10000)).toBe(true);
      expect(service.validateAmount(10000, 1000, 10000)).toBe(true);
    });

    it('should reject amounts outside range', () => {
      expect(service.validateAmount(500, 1000, 10000)).toBe(false);
      expect(service.validateAmount(15000, 1000, 10000)).toBe(false);
    });
  });

  describe('Metadata generation', () => {
    it('should generate metadata with description only', () => {
      const metadata = service.generateMetadata('Test payment');
      const parsed = JSON.parse(metadata);
      expect(parsed).toEqual([['text/plain', 'Test payment']]);
    });

    it('should generate metadata with description and image', () => {
      const metadata = service.generateMetadata(
        'Test payment',
        'https://example.com/image.png',
      );
      const parsed = JSON.parse(metadata);
      expect(parsed).toEqual([
        ['text/plain', 'Test payment'],
        ['image/png', 'https://example.com/image.png'],
      ]);
    });

    it('should detect image MIME types', () => {
      const jpgMetadata = service.generateMetadata(
        'Test',
        'https://example.com/image.jpg',
      );
      expect(jpgMetadata).toContain('image/jpeg');

      const gifMetadata = service.generateMetadata(
        'Test',
        'https://example.com/image.gif',
      );
      expect(gifMetadata).toContain('image/gif');
    });
  });

  describe('Domain checks', () => {
    it('should identify internal domains', () => {
      expect(service.isInternalDomain('bitsacco.com')).toBe(true);
      expect(service.isInternalDomain('www.bitsacco.com')).toBe(true);
      expect(service.isInternalDomain('api.bitsacco.com')).toBe(true);
    });

    it('should identify external domains', () => {
      expect(service.isInternalDomain('example.com')).toBe(false);
      expect(service.isInternalDomain('wallet.com')).toBe(false);
    });
  });

  describe('Callback URL generation', () => {
    it('should generate correct callback URLs', () => {
      const url = service.getCallbackUrl('/v1/lnurl/withdraw/callback');
      expect(url).toBe('https://api.bitsacco.com/v1/lnurl/withdraw/callback');
    });
  });

  describe('Success action formatting', () => {
    it('should format message success action', () => {
      const action = service.formatSuccessAction(
        'message',
        'Payment received!',
      );
      expect(action).toEqual({
        tag: 'message',
        message: 'Payment received!',
      });
    });

    it('should format URL success action', () => {
      const action = service.formatSuccessAction('url', {
        description: 'View receipt',
        url: 'https://example.com/receipt',
      });
      expect(action).toEqual({
        tag: 'url',
        description: 'View receipt',
        url: 'https://example.com/receipt',
      });
    });
  });
});
