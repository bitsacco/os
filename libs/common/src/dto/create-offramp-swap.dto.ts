import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  Validate,
  IsEnum,
  IsDefined,
  ValidateNested,
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
  @TransformToCurrency()
  @ApiProperty({ enum: SupportedCurrencies, enumName: 'SupportedCurrencyType' })
  currency: Currency;

  @IsDefined()
  @ValidateNested()
  @Type(() => MobileMoneyDto)
  @ApiProperty({ type: MobileMoneyDto })
  payout: MobileMoneyDto;
}

export class CreateOfframpSwapDto implements OfframpSwapRequest {
  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteDto)
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
  @ValidateNested()
  @Type(() => OfframpSwapTargetDto)
  @ApiProperty({ type: OfframpSwapTargetDto })
  target: OfframpSwapTargetDto;
}
