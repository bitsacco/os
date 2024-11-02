import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNotEmpty, Validate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OnrampSwapRequest, IsStringifiedNumberConstraint } from '../types';
import { QuoteDto } from './quote.dto';

export class CreateOnrampSwapDto implements OnrampSwapRequest {
  @IsOptional()
  @ApiProperty({ type: QuoteDto })
  quote: QuoteDto;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  ref: string;

  @IsNotEmpty()
  @IsString()
  @Validate(IsStringifiedNumberConstraint)
  @Type(() => String)
  @ApiProperty()
  amount: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  lightning: string;
}
