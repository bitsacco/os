import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

export class QuoteDto {
  @IsString()
  @Type(() => String)
  @ApiProperty()
  id: string;

  @IsBoolean()
  @Type(() => Boolean)
  @ApiProperty()
  refreshIfExpired: boolean;
}
