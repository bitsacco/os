import { User, Role } from './types';
import { generateId, generateNpub, hashPin } from './utils';
import { Logger } from '@nestjs/common';

const logger = new Logger('UsersSeed');

/**
 * Seed users with preset PINs that can be used to log in
 * Each user has a PIN that is documented in the comments
 * @returns Array of seeded users with hashed PINs
 */
export async function seedUsers(): Promise<User[]> {
  // Create users with consistent PINs for developer login
  // Format: [user data, pin]
  const userConfigs: [Omit<User, 'pinHash'>, string][] = [
    // User 1 - Super Admin with both phone and nostr (PIN: 123456)
    [
      {
        id: '43040650-5090-4dd4-8e93-8fd342533e7c',
        phone: {
          number: '+254700123456',
          verified: true,
        },
        nostr: {
          npub: generateNpub(),
          verified: true,
        },
        profile: {
          name: 'Jodom',
          avatar_url: 'https://example.com/avatars/admin.jpg',
        },
        roles: [Role.Member, Role.Admin, Role.SuperAdmin],
        otpHash: '',
        otpExpiry: undefined
      },
      '123456',
    ],

    // User 2 - Admin with phone only (PIN: 111111)
    [
      {
        id: '7b158dfd-cb98-40b1-9ed2-a13006a9f670',
        phone: {
          number: '+254701234567',
          verified: true,
        },
        profile: {
          name: 'Isaack',
        },
        roles: [Role.Member, Role.Admin],
        otpHash: '',
        otpExpiry: undefined
      },
      '111111',
    ],

    // User 3 - Admin with nostr only (PIN: 222222)
    [
      {
        id: generateId(),
        nostr: {
          npub: generateNpub(),
          verified: true,
        },
        profile: {
          name: 'Nostr Admin',
        },
        roles: [Role.Member, Role.Admin],
        otpHash: '',
        otpExpiry: undefined
      },
      '222222',
    ],

    // User 4 - Regular member with phone only (PIN: 333333)
    [
      {
        id: generateId(),
        phone: {
          number: '+254702345678',
          verified: true,
        },
        profile: {
          name: 'Phone Member',
        },
        roles: [Role.Member],
        otpHash: '',
        otpExpiry: undefined
      },
      '333333',
    ],

    // User 5 - Regular member with nostr only (PIN: 444444)
    [
      {
        id: generateId(),
        nostr: {
          npub: generateNpub(),
          verified: true,
        },
        profile: {
          name: 'Nostr Member',
        },
        roles: [Role.Member],
        otpHash: '',
        otpExpiry: undefined
      },
      '444444',
    ],

    // User 6 - Regular member with both phone and nostr (PIN: 555555)
    [
      {
        id: generateId(),
        phone: {
          number: '+254703456789',
          verified: true,
        },
        nostr: {
          npub: generateNpub(),
          verified: true,
        },
        profile: {
          name: 'Complete Member',
          avatar_url: 'https://example.com/avatars/member.jpg',
        },
        roles: [Role.Member],
        otpHash: '',
        otpExpiry: undefined
      },
      '555555',
    ],

    // User 7 - Member with unverified phone (PIN: 666666)
    [
      {
        id: generateId(),
        phone: {
          number: '+254704567890',
          verified: false,
        },
        profile: {
          name: 'Unverified Phone Member',
        },
        roles: [Role.Member],
        otpHash: '',
        otpExpiry: undefined
      },
      '666666',
    ],
  ];

  // Generate users with hashed PINs
  const users: User[] = await Promise.all(
    userConfigs.map(async ([userData, pin]) => {
      // Hash the PIN using argon2 (same as auth service)
      const pinHash = await hashPin(pin);

      // Log the user's login details for developer reference
      let loginInfo = userData.profile?.name || 'User';
      if (userData.phone) {
        loginInfo += ` (phone: ${userData.phone.number})`;
      }
      if (userData.nostr) {
        loginInfo += ` (npub: ${userData.nostr.npub})`;
      }
      logger.log(`Created user: ${loginInfo} with PIN: ${pin}`);

      // Also hash the pin for OTP (required field as per schema)
      const otpHash = await hashPin(pin);
      
      // Set OTP expiry to 10 minutes from now
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      return {
        ...userData,
        pinHash,
        otpHash,
        otpExpiry,
      };
    }),
  );

  return users;
}
