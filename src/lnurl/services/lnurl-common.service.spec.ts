import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LnurlCommonService } from './lnurl-common.service';

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
                LNURL_SIGNING_SECRET: 'test-signing-secret',
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
      expect(service.fiatToMsats(100, btcToKesRate)).toBe(2000000); // 100 KES = 2M msats
      expect(service.fiatToMsats(1000, btcToKesRate)).toBe(20000000); // 1000 KES = 20M msats
    });

    it('should convert millisatoshis to fiat', () => {
      expect(service.msatsToFiat(2000000, btcToKesRate)).toBe(100);
      expect(service.msatsToFiat(20000000, btcToKesRate)).toBe(1000);
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

  describe('Invoice signature generation and verification', () => {
    const testInvoice = 'lnbc100n1p0example...'; // Example BOLT11 invoice

    it('should generate a signature for an invoice', () => {
      const signature = service.generateInvoiceSignature(testInvoice);
      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      // HMAC-SHA256 produces 64 character hex string
      expect(signature.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(signature)).toBe(true);
    });

    it('should generate consistent signatures for the same invoice', () => {
      const signature1 = service.generateInvoiceSignature(testInvoice);
      const signature2 = service.generateInvoiceSignature(testInvoice);
      expect(signature1).toBe(signature2);
    });

    it('should generate different signatures for different invoices', () => {
      const invoice1 = 'lnbc100n1p0example1...';
      const invoice2 = 'lnbc100n1p0example2...';
      const signature1 = service.generateInvoiceSignature(invoice1);
      const signature2 = service.generateInvoiceSignature(invoice2);
      expect(signature1).not.toBe(signature2);
    });

    it('should verify a valid signature', () => {
      const signature = service.generateInvoiceSignature(testInvoice);
      const isValid = service.verifyInvoiceSignature(testInvoice, signature);
      expect(isValid).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const invalidSignature = 'a'.repeat(64); // Invalid signature
      const isValid = service.verifyInvoiceSignature(
        testInvoice,
        invalidSignature,
      );
      expect(isValid).toBe(false);
    });

    it('should reject a signature for a different invoice', () => {
      const invoice1 = 'lnbc100n1p0example1...';
      const invoice2 = 'lnbc100n1p0example2...';
      const signature1 = service.generateInvoiceSignature(invoice1);
      const isValid = service.verifyInvoiceSignature(invoice2, signature1);
      expect(isValid).toBe(false);
    });
  });
});
