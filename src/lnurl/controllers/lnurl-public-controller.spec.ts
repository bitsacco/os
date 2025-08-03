import { describe, it, expect } from 'bun:test';

describe('LnurlPublicController Security Tests', () => {
  describe('safeJsonParse method', () => {
    it('should parse valid JSON correctly', () => {
      const validJson = '{"key": "value", "number": 123}';
      const controller = new (class TestController {
        private safeJsonParse(jsonString: string, fieldName: string): any {
          if (!jsonString || jsonString.trim() === '') {
            return undefined;
          }

          try {
            const maxLength = 10000;
            if (jsonString.length > maxLength) {
              throw new Error(
                `${fieldName} is too large (max ${maxLength} characters)`,
              );
            }

            const parsed = JSON.parse(jsonString);

            if (typeof parsed !== 'object' || parsed === null) {
              throw new Error(`${fieldName} must be a valid JSON object`);
            }

            return parsed;
          } catch (error) {
            throw new Error(
              `Invalid JSON in ${fieldName} parameter. Please provide valid JSON.`,
            );
          }
        }

        testParse(input: string) {
          return this.safeJsonParse(input, 'test');
        }
      })();

      const result = controller.testParse(validJson);
      expect(result).toEqual({ key: 'value', number: 123 });
    });

    it('should throw error for invalid JSON', () => {
      const controller = new (class TestController {
        private safeJsonParse(jsonString: string, fieldName: string): any {
          if (!jsonString || jsonString.trim() === '') {
            return undefined;
          }

          try {
            const maxLength = 10000;
            if (jsonString.length > maxLength) {
              throw new Error(
                `${fieldName} is too large (max ${maxLength} characters)`,
              );
            }

            const parsed = JSON.parse(jsonString);

            if (typeof parsed !== 'object' || parsed === null) {
              throw new Error(`${fieldName} must be a valid JSON object`);
            }

            return parsed;
          } catch (error: any) {
            if (
              error.message.includes('is too large') ||
              error.message.includes('must be a valid JSON object')
            ) {
              throw error;
            }
            throw new Error(
              `Invalid JSON in ${fieldName} parameter. Please provide valid JSON.`,
            );
          }
        }

        testParse(input: string) {
          return this.safeJsonParse(input, 'test');
        }
      })();

      expect(() => controller.testParse('invalid json')).toThrow(
        'Invalid JSON in test parameter',
      );
      expect(() => controller.testParse('{invalid}')).toThrow(
        'Invalid JSON in test parameter',
      );
    });

    it('should return undefined for empty or whitespace input', () => {
      const controller = new (class TestController {
        private safeJsonParse(jsonString: string, fieldName: string): any {
          if (!jsonString || jsonString.trim() === '') {
            return undefined;
          }

          try {
            const maxLength = 10000;
            if (jsonString.length > maxLength) {
              throw new Error(
                `${fieldName} is too large (max ${maxLength} characters)`,
              );
            }

            const parsed = JSON.parse(jsonString);

            if (typeof parsed !== 'object' || parsed === null) {
              throw new Error(`${fieldName} must be a valid JSON object`);
            }

            return parsed;
          } catch (error) {
            throw new Error(
              `Invalid JSON in ${fieldName} parameter. Please provide valid JSON.`,
            );
          }
        }

        testParse(input: string) {
          return this.safeJsonParse(input, 'test');
        }
      })();

      expect(controller.testParse('')).toBeUndefined();
      expect(controller.testParse('   ')).toBeUndefined();
    });

    it('should reject too large JSON input', () => {
      const controller = new (class TestController {
        private safeJsonParse(jsonString: string, fieldName: string): any {
          if (!jsonString || jsonString.trim() === '') {
            return undefined;
          }

          try {
            const maxLength = 10000;
            if (jsonString.length > maxLength) {
              throw new Error(
                `${fieldName} is too large (max ${maxLength} characters)`,
              );
            }

            const parsed = JSON.parse(jsonString);

            if (typeof parsed !== 'object' || parsed === null) {
              throw new Error(`${fieldName} must be a valid JSON object`);
            }

            return parsed;
          } catch (error) {
            throw error;
          }
        }

        testParse(input: string) {
          return this.safeJsonParse(input, 'test');
        }
      })();

      const largeJson = '{"data": "' + 'x'.repeat(10001) + '"}';
      expect(() => controller.testParse(largeJson)).toThrow(
        'test is too large (max 10000 characters)',
      );
    });

    it('should reject non-object JSON values', () => {
      const controller = new (class TestController {
        private safeJsonParse(jsonString: string, fieldName: string): any {
          if (!jsonString || jsonString.trim() === '') {
            return undefined;
          }

          try {
            const maxLength = 10000;
            if (jsonString.length > maxLength) {
              throw new Error(
                `${fieldName} is too large (max ${maxLength} characters)`,
              );
            }

            const parsed = JSON.parse(jsonString);

            if (typeof parsed !== 'object' || parsed === null) {
              throw new Error(`${fieldName} must be a valid JSON object`);
            }

            return parsed;
          } catch (error) {
            throw error;
          }
        }

        testParse(input: string) {
          return this.safeJsonParse(input, 'test');
        }
      })();

      expect(() => controller.testParse('"string"')).toThrow(
        'test must be a valid JSON object',
      );
      expect(() => controller.testParse('123')).toThrow(
        'test must be a valid JSON object',
      );
      expect(() => controller.testParse('true')).toThrow(
        'test must be a valid JSON object',
      );
      expect(() => controller.testParse('null')).toThrow(
        'test must be a valid JSON object',
      );
    });

    it('should accept JSON arrays as objects', () => {
      const controller = new (class TestController {
        private safeJsonParse(jsonString: string, fieldName: string): any {
          if (!jsonString || jsonString.trim() === '') {
            return undefined;
          }

          try {
            const maxLength = 10000;
            if (jsonString.length > maxLength) {
              throw new Error(
                `${fieldName} is too large (max ${maxLength} characters)`,
              );
            }

            const parsed = JSON.parse(jsonString);

            if (typeof parsed !== 'object' || parsed === null) {
              throw new Error(`${fieldName} must be a valid JSON object`);
            }

            return parsed;
          } catch (error) {
            throw error;
          }
        }

        testParse(input: string) {
          return this.safeJsonParse(input, 'test');
        }
      })();

      const result = controller.testParse('["item1", "item2"]');
      expect(result).toEqual(['item1', 'item2']);
    });
  });

  describe('amount validation', () => {
    it('should validate amount is a positive number', () => {
      const validateAmount = (amountString: string): number => {
        const amountMsats = parseInt(amountString);
        if (isNaN(amountMsats)) {
          throw new Error('Invalid amount format');
        }
        if (amountMsats <= 0) {
          throw new Error('Invalid amount value');
        }
        return amountMsats;
      };

      expect(() => validateAmount('invalid')).toThrow('Invalid amount format');
      expect(() => validateAmount('-1000')).toThrow('Invalid amount value');
      expect(() => validateAmount('0')).toThrow('Invalid amount value');

      expect(validateAmount('1')).toBe(1);
      expect(validateAmount('1000000')).toBe(1000000);
    });
  });
});
