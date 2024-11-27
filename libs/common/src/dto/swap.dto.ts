import {
  IsString,
  IsOptional,
  IsNotEmpty,
  Validate,
  IsDefined,
  IsEnum,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  OnrampSwapRequest,
  IsStringifiedNumberConstraint,
  OnrampSwapSource,
  Currency,
  OnrampSwapTarget,
  SupportedCurrencies,
  FindSwapRequest,
  OfframpSwapRequest,
  OfframpSwapTarget,
  PaginatedRequest,
} from '../types';
import { Bolt11InvoiceDto, MobileMoneyDto } from './payments.dto';
import { TransformToCurrency } from './transforms';
import { QuoteDto } from './quote.dto';

class OnrampSwapSourceDto implements OnrampSwapSource {
  @IsEnum(Currency)
  @TransformToCurrency()
  @ApiProperty({ enum: SupportedCurrencies, enumName: 'SupportedCurrencyType' })
  currency: Currency;

  @IsDefined()
  @ValidateNested()
  @Type(() => MobileMoneyDto)
  @ApiProperty({ type: MobileMoneyDto })
  origin: MobileMoneyDto | undefined;
}

class OnrampSwapTargetDto implements OnrampSwapTarget {
  @IsDefined()
  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto })
  payout: Bolt11InvoiceDto;
}

export class CreateOnrampSwapDto implements OnrampSwapRequest {
  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteDto)
  @ApiProperty({ type: QuoteDto })
  quote: QuoteDto;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference: string;

  @IsNotEmpty()
  @IsString()
  @Validate(IsStringifiedNumberConstraint)
  @Type(() => String)
  @ApiProperty()
  amountFiat: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => OnrampSwapSourceDto)
  @ApiProperty({ type: OnrampSwapSourceDto })
  source: OnrampSwapSourceDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => OnrampSwapTargetDto)
  @ApiProperty({ type: OnrampSwapTargetDto })
  target: OnrampSwapTargetDto;
}


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
  reference: string;

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

export class FindSwapDto implements FindSwapRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  id: string;
}

export class ListSwapsDto implements PaginatedRequest {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  page: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  size: number;
}
