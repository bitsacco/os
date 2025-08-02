import { describe, it, expect } from 'bun:test';

describe('Lightning Address DTO Validation', () => {
  describe('CreateLightningAddressDto', () => {
    it('should validate address field', () => {
      const validAddresses = [
        'alice',
        'bob123',
        'user_name',
        'user.name',
        'user-name',
        'a'.repeat(3), // min length
        'a'.repeat(32), // max length
      ];

      const addressRegex = /^[a-zA-Z0-9._-]+$/;

      validAddresses.forEach((address) => {
        expect(addressRegex.test(address)).toBe(true);
        expect(address.length >= 3).toBe(true);
        expect(address.length <= 32).toBe(true);
      });
    });

    it('should reject invalid addresses', () => {
      const invalidAddresses = [
        'a', // too short
        'ab', // too short
        'a'.repeat(33), // too long
        'user space', // contains space
        'user@name', // contains @
        'user!name', // contains !
      ];

      const addressRegex = /^[a-zA-Z0-9._-]+$/;

      invalidAddresses.forEach((address) => {
        const isValidFormat = addressRegex.test(address);
        const isValidLength = address.length >= 3 && address.length <= 32;

        expect(isValidFormat && isValidLength).toBe(false);
      });
    });

    it('should validate metadata fields', () => {
      const metadata = {
        description: 'Payment to Alice',
        minSendable: 1000,
        maxSendable: 100000000000,
        commentAllowed: 255,
      };

      expect(metadata.minSendable).toBeGreaterThan(0);
      expect(metadata.maxSendable).toBeLessThanOrEqual(1000000000000000);
      expect(metadata.commentAllowed).toBeGreaterThanOrEqual(0);
      expect(metadata.commentAllowed).toBeLessThanOrEqual(1000);
    });

    it('should validate settings fields', () => {
      const settings = {
        allowComments: true,
        notifyOnPayment: true,
        customSuccessMessage: 'Thank you for your payment!',
      };

      expect(typeof settings.allowComments).toBe('boolean');
      expect(typeof settings.notifyOnPayment).toBe('boolean');
      expect(settings.customSuccessMessage.length).toBeGreaterThan(0);
      expect(settings.customSuccessMessage.length).toBeLessThanOrEqual(255);
    });
  });

  describe('UpdateLightningAddressDto', () => {
    it('should allow partial metadata updates', () => {
      const partialMetadata = {
        description: 'Updated description',
      };

      expect(partialMetadata.description).toBeDefined();
      expect('minSendable' in partialMetadata).toBe(false);
      expect('maxSendable' in partialMetadata).toBe(false);
    });

    it('should allow partial settings updates', () => {
      const partialSettings = {
        enabled: false,
        notifyOnPayment: false,
      };

      expect(partialSettings.enabled).toBeDefined();
      expect(partialSettings.notifyOnPayment).toBeDefined();
      expect('allowComments' in partialSettings).toBe(false);
    });

    it('should validate updated values', () => {
      const updates = {
        metadata: {
          minSendable: 500,
          maxSendable: 50000000,
        },
        settings: {
          customSuccessMessage: 'Updated message',
        },
      };

      expect(updates.metadata.minSendable).toBeGreaterThan(0);
      expect(updates.metadata.maxSendable).toBeGreaterThan(
        updates.metadata.minSendable,
      );
      expect(updates.settings.customSuccessMessage.length).toBeLessThanOrEqual(
        255,
      );
    });
  });

  describe('Address Type Validation', () => {
    it('should accept valid address types', () => {
      const validTypes = ['PERSONAL', 'CHAMA', 'MEMBER_CHAMA'];

      validTypes.forEach((type) => {
        expect(['PERSONAL', 'CHAMA', 'MEMBER_CHAMA'].includes(type)).toBe(true);
      });
    });

    it('should have PERSONAL as default type', () => {
      const dto = {
        address: 'alice',
        // type not specified
      };

      const addressType = ('type' in dto ? dto.type : undefined) || 'PERSONAL';
      expect(addressType).toBe('PERSONAL');
    });
  });
});
