import { Type } from 'class-transformer';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Bolt11, MobileMoney } from '../types';

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
