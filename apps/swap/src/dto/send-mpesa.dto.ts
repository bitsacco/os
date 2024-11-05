import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Validate } from 'class-validator';
import { NormalizePhoneNumber } from './utils';
import { IsStringifiedNumberConstraint } from '@bitsacco/common';

export class SendMpesaDto {
  @IsNotEmpty()
  @IsString()
  @Validate(IsStringifiedNumberConstraint)
  @Type(() => String)
  amount: string;

  @NormalizePhoneNumber()
  @IsString()
  @Length(12, 12)
  account: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  name: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  narrative: string;
}
