import {
  IsString,
  IsOptional,
  IsNotEmpty,
  Validate,
  IsDefined,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  OnrampSwapRequest,
  IsStringifiedNumberConstraint,
  OnrampSwapSource,
  Currency,
  OnrampSwapTarget,
} from '../types';
import { Bolt11InvoiceDto, MobileMoneyDto } from './payments.dto';
import { QuoteDto } from './quote.dto';

class OnrampSwapSourceDto implements OnrampSwapSource {
  @IsEnum(Currency)
  @ApiProperty({ enum: Currency, enumName: 'Currency' })
  currency: Currency;

  @IsDefined()
  @ApiProperty({ type: MobileMoneyDto })
  origin: MobileMoneyDto;
}

class OnrampSwapTargetDto implements OnrampSwapTarget {
  @IsDefined()
  @ApiProperty({ type: Bolt11InvoiceDto })
  invoice: Bolt11InvoiceDto;
}

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
  amountFiat: string;

  @IsNotEmpty()
  @ApiProperty({ type: OnrampSwapSourceDto })
  source: OnrampSwapSourceDto;

  @IsNotEmpty()
  @ApiProperty({ type: OnrampSwapTargetDto })
  target: OnrampSwapTargetDto;
}
