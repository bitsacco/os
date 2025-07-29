import { bech32 } from 'bech32';
import { randomBytes } from 'crypto';

/**
 * Encode a URL into LNURL format
 * @param url The URL to encode
 * @returns The LNURL encoded string
 */
export function encodeLnurl(url: string): string {
  const words = bech32.toWords(Buffer.from(url, 'utf8'));
  return bech32.encode('lnurl', words, 1023);
}

/**
 * Decode an LNURL string back to URL
 * @param lnurl The LNURL string to decode
 * @returns The decoded URL
 */
export function decodeLnurl(lnurl: string): string {
  try {
    const decoded = bech32.decode(lnurl.toLowerCase(), 1023);
    const data = bech32.fromWords(decoded.words);
    return Buffer.from(data).toString('utf8');
  } catch (error) {
    throw new Error(`Invalid LNURL: ${error.message}`);
  }
}

/**
 * Check if a string is a valid LNURL
 * @param input The string to check
 * @returns True if valid LNURL
 */
export function isValidLnurl(input: string): boolean {
  try {
    if (!input || typeof input !== 'string') {
      return false;
    }

    // LNURL must be lowercase (bech32 requirement)
    if (input !== input.toLowerCase()) {
      return false;
    }

    // Must have correct prefix
    if (!input.startsWith('lnurl')) {
      return false;
    }

    // Validate bech32 format
    const decoded = bech32.decode(input, 1023);

    // Check that HRP (human-readable part) is 'lnurl'
    if (decoded.prefix !== 'lnurl') {
      return false;
    }

    // Decode to get the URL
    const data = bech32.fromWords(decoded.words);
    const url = Buffer.from(data).toString('utf8');

    // Must be a valid URL
    const parsedUrl = new URL(url);

    // LNURL should use HTTPS (except for localhost/development)
    if (
      parsedUrl.protocol !== 'https:' &&
      parsedUrl.hostname !== 'localhost' &&
      parsedUrl.hostname !== '127.0.0.1' &&
      !parsedUrl.hostname.endsWith('.local')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string is a Lightning Address
 * @param input The string to check
 * @returns True if valid Lightning Address
 */
export function isLightningAddress(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Lightning address pattern: username@domain.com
  const pattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(input);
}

/**
 * Parse a Lightning Address into components
 * @param address The Lightning Address to parse
 * @returns Object with username and domain
 */
export function parseLightningAddress(address: string): {
  username: string;
  domain: string;
} {
  if (!isLightningAddress(address)) {
    throw new Error('Invalid Lightning Address format');
  }

  const [username, domain] = address.split('@');
  return { username, domain };
}

/**
 * Construct the LNURL-pay URL for a Lightning Address
 * @param address The Lightning Address
 * @returns The LNURL-pay URL
 */
export function getLightningAddressUrl(address: string): string {
  const { username, domain } = parseLightningAddress(address);
  return `https://${domain}/.well-known/lnurlp/${username}`;
}

/**
 * Generate a random k1 value for LNURL-withdraw
 * @returns A random 32-byte hex string
 */
export function generateK1(): string {
  return randomBytes(32).toString('hex');
}
