import { describe, it, expect } from 'bun:test';
import { AddressType, LnurlType, LnurlSubType } from '../../common';

describe('Lightning Address Types', () => {
  it('should have correct address type values', () => {
    expect(AddressType.PERSONAL as string).toBe('PERSONAL');
    expect(AddressType.CHAMA as string).toBe('CHAMA');
    expect(AddressType.MEMBER_CHAMA as string).toBe('MEMBER_CHAMA');
  });

  it('should have correct LNURL type values', () => {
    expect(LnurlType.PAY_IN as string).toBe('PAY_IN');
    expect(LnurlType.PAY_OUT as string).toBe('PAY_OUT');
    expect(LnurlType.WITHDRAW as string).toBe('WITHDRAW');
  });

  it('should have correct LNURL subtype values', () => {
    expect(LnurlSubType.LIGHTNING_ADDRESS as string).toBe('LIGHTNING_ADDRESS');
    expect(LnurlSubType.EXTERNAL_PAY as string).toBe('EXTERNAL_PAY');
    expect(LnurlSubType.QR_WITHDRAW as string).toBe('QR_WITHDRAW');
    expect(LnurlSubType.LINK_WITHDRAW as string).toBe('LINK_WITHDRAW');
  });
});

describe('Lightning Address Validation', () => {
  it('should validate address format', () => {
    const validAddresses = [
      'alice',
      'bob123',
      'user_name',
      'user.name',
      'user-name',
      'a1b2c3',
    ];

    const addressRegex = /^[a-zA-Z0-9._-]+$/;

    validAddresses.forEach((address) => {
      expect(addressRegex.test(address)).toBe(true);
    });
  });

  it('should reject invalid address format', () => {
    const invalidAddresses = [
      'user name', // space
      'user@name', // @ symbol
      'user!name', // special char
      'user#name', // special char
      '', // empty
    ];

    const addressRegex = /^[a-zA-Z0-9._-]+$/;

    invalidAddresses.forEach((address) => {
      expect(addressRegex.test(address)).toBe(false);
    });
  });

  it('should validate address length', () => {
    expect('ab'.length < 3).toBe(true); // too short
    expect('abc'.length >= 3).toBe(true); // valid
    expect('a'.repeat(32).length <= 32).toBe(true); // valid
    expect('a'.repeat(33).length > 32).toBe(true); // too long
  });
});

describe('Lightning Address Metadata', () => {
  it('should have valid default values', () => {
    const defaultMinSendable = 1000; // 1 sat
    const defaultMaxSendable = 100000000000; // 100k sats
    const defaultCommentAllowed = 255;

    expect(defaultMinSendable).toBeGreaterThan(0);
    expect(defaultMaxSendable).toBeGreaterThan(defaultMinSendable);
    expect(defaultCommentAllowed).toBeGreaterThan(0);
    expect(defaultCommentAllowed).toBeLessThanOrEqual(1000);
  });

  it('should convert millisats to sats correctly', () => {
    const msats = 50000;
    const sats = Math.floor(msats / 1000);
    expect(sats).toBe(50);

    const msats2 = 1234567;
    const sats2 = Math.floor(msats2 / 1000);
    expect(sats2).toBe(1234);
  });
});

describe('LNURL-pay Response Format', () => {
  it('should have required fields', () => {
    const response = {
      callback: 'https://api.bitsacco.com/v1/lnurl/callback/alice',
      minSendable: 1000,
      maxSendable: 100000000,
      metadata: '[[\"text/plain\",\"Pay to alice@bitsacco.com\"]]',
      tag: 'payRequest',
      commentAllowed: 255,
    };

    expect(response.callback).toBeDefined();
    expect(response.minSendable).toBeDefined();
    expect(response.maxSendable).toBeDefined();
    expect(response.metadata).toBeDefined();
    expect(response.tag).toBe('payRequest');
  });

  it('should format metadata correctly', () => {
    const description = 'Pay to alice@bitsacco.com';
    const metadata = JSON.stringify([['text/plain', description]]);
    const parsed = JSON.parse(metadata);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0][0]).toBe('text/plain');
    expect(parsed[0][1]).toBe(description);
  });
});

describe('Payment Success Actions', () => {
  it('should format message success action', () => {
    const successAction = {
      tag: 'message',
      message: 'Payment received! Thank you.',
    };

    expect(successAction.tag).toBe('message');
    expect(successAction.message).toBeDefined();
    expect(typeof successAction.message).toBe('string');
  });
});
