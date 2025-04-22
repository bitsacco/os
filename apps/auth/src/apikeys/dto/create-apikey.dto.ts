import { ApiKeyScope } from '@bitsacco/common';
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

export class CreateApiKeyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;
  
  @IsOptional()
  @IsString()
  ownerId?: string;
  
  @IsArray()
  @IsEnum(ApiKeyScope, { each: true })
  scopes: ApiKeyScope[];
  
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
  
  @IsOptional()
  @IsString()
  description?: string;
  
  @IsOptional()
  @IsString()
  userAgent?: string;
}