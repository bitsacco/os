import { ApiKeyScope } from '@bitsacco/common';

export class ApiKeyResponseDto {
  id: string;
  key?: string; // Only included when creating a new key
  name: string;
  scopes: ApiKeyScope[];
  expiresAt: Date;
}