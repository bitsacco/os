import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiKeyScope } from '@bitsacco/common';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsArray()
  @IsEnum(ApiKeyScope, { each: true })
  scopes: ApiKeyScope[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class ApiKeyResponseDto {
  id: string;
  key?: string; // Only included when creating a new key
  name: string;
  scopes: ApiKeyScope[];
  expiresAt: Date;
}
