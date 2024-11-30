import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { PaginatedRequest } from '../types';
import { ApiProperty } from '@nestjs/swagger';

export class PaginatedRequestDto implements PaginatedRequest {
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ type: Number })
  page: number;

  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ type: Number })
  size: number;
}
