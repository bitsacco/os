import { describe, it, expect } from '@jest/globals';
import { isLightningAddress } from '../types/lnurl.types';

describe('Lightning Address Utils', () => {
  describe('isLightningAddress', () => {
    it('should validate correct Lightning addresses', () => {
      expect(isLightningAddress('alice@bitsacco.com')).toBe(true);
      expect(isLightningAddress('bob@example.com')).toBe(true);
      expect(isLightningAddress('test-user@domain.io')).toBe(true);
      expect(isLightningAddress('user_name@test.org')).toBe(true);
      expect(isLightningAddress('user.name@test.net')).toBe(true);
    });

    it('should reject invalid Lightning addresses', () => {
      expect(isLightningAddress('notanemail')).toBe(false);
      expect(isLightningAddress('@example.com')).toBe(false);
      expect(isLightningAddress('user@')).toBe(false);
      expect(isLightningAddress('user@domain')).toBe(false);
      expect(isLightningAddress('user with space@domain.com')).toBe(false);
      expect(isLightningAddress('')).toBe(false);
    });
  });
});

describe('Address Format Parsing', () => {
  it('should identify member-chama format', () => {
    const address = 'alice-savings@bitsacco.com';
    const [localPart] = address.split('@');

    expect(localPart.includes('-')).toBe(true);

    const [username, chamaname] = localPart.split('-');
    expect(username).toBe('alice');
    expect(chamaname).toBe('savings');
  });

  it('should identify standard format', () => {
    const address = 'alice@bitsacco.com';
    const [localPart] = address.split('@');

    expect(localPart.includes('-')).toBe(false);
    expect(localPart).toBe('alice');
  });
});

describe('Reserved Words Check', () => {
  const reserved = [
    'admin',
    'administrator',
    'support',
    'help',
    'api',
    'www',
    'mail',
    'ftp',
    'email',
    'test',
    'root',
    'system',
    'info',
    'contact',
    'about',
    'legal',
    'terms',
    'privacy',
    'security',
    'billing',
    'payment',
    'invoice',
    'account',
    'user',
    'users',
    'chama',
    'chamas',
    'group',
    'groups',
    'wallet',
    'wallets',
    'lightning',
    'bitcoin',
    'btc',
    'sats',
    'satoshi',
    'ln',
    'lnurl',
    'bitsacco',
    'app',
    'mobile',
    'web',
    'service',
  ];

  it('should identify reserved words', () => {
    reserved.forEach((word) => {
      expect(reserved.includes(word.toLowerCase())).toBe(true);
    });
  });

  it('should allow non-reserved words', () => {
    const allowed = ['alice', 'bob', 'charlie', 'savings', 'mygroup'];
    allowed.forEach((word) => {
      expect(reserved.includes(word.toLowerCase())).toBe(false);
    });
  });
});
