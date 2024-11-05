import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Length, Min } from 'class-validator';
import { NormalizePhoneNumber } from './utils';

export class SendSTKPushDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @NormalizePhoneNumber()
  @IsString()
  @Length(12, 12)
  phone_number: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  api_ref: string;
}
