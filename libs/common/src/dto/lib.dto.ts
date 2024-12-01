import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { PaginatedRequest } from '../types';
import { ApiProperty } from '@nestjs/swagger';

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
