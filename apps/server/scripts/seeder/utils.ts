import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from './types';
import * as argon2 from 'argon2';

/**
 * Generate a random UUID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generate a random phone number in Kenya format
 */
export function generatePhoneNumber(): string {
  const prefixes = [
    '254700',
    '254701',
    '254702',
    '254703',
    '254704',
    '254705',
    '254710',
    '254711',
    '254712',
  ];
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomSuffix = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
  return `${randomPrefix}${randomSuffix}`;
}

/**
 * Generate a random nostr npub
 */
export function generateNpub(): string {
  // This is a simplified version, real npubs have a specific format
  return `npub1${Array.from(
    { length: 32 },
    () => '0123456789abcdefghjklmnpqrstuvwxyz'[Math.floor(Math.random() * 35)],
  ).join('')}`;
}

/**
 * Generate a random date between start and end dates
 */
export function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

/**
 * Generate a random date string in ISO format
 */
export function randomDateString(start: Date, end: Date): string {
  return randomDate(start, end).toISOString();
}

/**
 * Generate a random amount in Kenyan shillings (KES)
 */
export function randomAmountKES(
  min: number = 100,
  max: number = 10000,
): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Convert KES to millisatoshis (simplified conversion)
 */
export function kesToMsats(amountKES: number): number {
  // Simplified conversion rate: 1 KES = 1000 msats
  return amountKES * 1000;
}

/**
 * Generate a random lightning invoice
 */
export function generateLightningInvoice(): string {
  // This is a simplified version, real lightning invoices have a specific format
  return `lnbc${Math.floor(Math.random() * 1000000)}${Array.from(
    { length: 100 },
    () =>
      '0123456789abcdefghjklmnpqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'[
        Math.floor(Math.random() * 62)
      ],
  ).join('')}`;
}

/**
 * Generate a random reference string
 */
export function generateReference(type: TransactionType): string {
  const prefix = type === TransactionType.DEPOSIT ? 'DEP' : 'WTH';
  const randomChars = Array.from(
    { length: 8 },
    () =>
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)],
  ).join('');
  return `${prefix}-${randomChars}`;
}

/**
 * Randomly select items from an array
 */
export function randomSelect<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Shuffle an array randomly
 */
export function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => 0.5 - Math.random());
}

/**
 * Hash a PIN using argon2, the same algorithm used by the auth service
 */
export async function hashPin(pin: string): Promise<string> {
  return await argon2.hash(pin);
}
