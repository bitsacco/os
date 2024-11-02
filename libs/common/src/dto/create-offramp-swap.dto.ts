import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  Validate,
  IsEnum,
  IsDefined,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  Currency,
  IsStringifiedNumberConstraint,
  MobileMoney,
  OfframpSwapRequest,
  OfframpSwapTarget,
} from '../types';
import { QuoteDto } from './quote.dto';

class MobileMoneyDto implements MobileMoney {
  @IsString()
  @Type(() => String)
  @ApiProperty()
  phone: string;
}

class OfframpSwapTargetDto implements OfframpSwapTarget {
  @IsEnum(Currency)
  @ApiProperty({ enum: Currency, enumName: 'Currency' })
  currency: Currency;

  @IsDefined()
  @ApiProperty({ type: MobileMoneyDto })
  destination: MobileMoneyDto;
}

export class CreateOfframpSwapDto implements OfframpSwapRequest {
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
  @ApiProperty({ type: OfframpSwapTargetDto })
  target: OfframpSwapTargetDto;
}
