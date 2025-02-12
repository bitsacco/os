import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { type PaginatedRequest } from '../types';

export class PaginatedRequestDto implements PaginatedRequest {
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ type: Number, example: 0 })
  page: number;

  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ type: Number, example: 10 })
  size: number;
}

// Decorator Factories
export const IsRequiredUUID = () => {
  return (target: any, propertyKey: string) => {
    IsString()(target, propertyKey);
    IsNotEmpty()(target, propertyKey);
    IsUUID()(target, propertyKey);
  };
};

export const IsOptionalUUID = () => {
  return (target: any, propertyKey: string) => {
    IsString()(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsUUID()(target, propertyKey);
  };
};
