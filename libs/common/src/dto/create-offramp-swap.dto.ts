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
  OfframpSwapRequest,
  OfframpSwapTarget,
  SupportedCurrencies,
} from '../types';
import { QuoteDto } from './quote.dto';
import { MobileMoneyDto } from './payments.dto';
import { TransformToCurrency } from './transforms';

class OfframpSwapTargetDto implements OfframpSwapTarget {
  @IsEnum(Currency)
  @ApiProperty({ enum: SupportedCurrencies, enumName: 'SupportedCurrencyType' })
  @TransformToCurrency()
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
  amountFiat: string;

  @IsNotEmpty()
  @ApiProperty({ type: OfframpSwapTargetDto })
  target: OfframpSwapTargetDto;
}
