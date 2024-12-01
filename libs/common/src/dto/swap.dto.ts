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
  IsBoolean,
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
  MobileMoney,
  Bolt11,
  QuoteRequest,
} from '../types';
import { TransformToCurrency } from './transforms';

export class QuoteRequestDto implements QuoteRequest {
  from: Currency;
  to: Currency;
  amount?: string;
}

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

export class MobileMoneyDto implements MobileMoney {
  @IsString()
  @Type(() => String)
  @ApiProperty()
  phone: string;
}

export class Bolt11InvoiceDto implements Bolt11 {
  @IsString()
  @Type(() => String)
  @ApiProperty()
  invoice: string;
}

export class OnrampSwapSourceDto implements OnrampSwapSource {
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
  @ApiProperty({ type: QuoteDto, example: null })
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
  @ApiProperty({ example: '2' })
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
  @ApiProperty({ example: 0 })
  page: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @ApiProperty({ example: 10 })
  size: number;
}
