import { IsOptional, IsBoolean, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './base.dto';

export class ListTargetsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by favorites only',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  favorites?: boolean;
}

export class PaymentHistoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by target ID',
  })
  @IsOptional()
  @IsMongoId()
  targetId?: string;
}
