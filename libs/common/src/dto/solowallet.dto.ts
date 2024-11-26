import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateOnrampSwapDto } from './create-onramp-swap.dto';
import { DepositFundsRequest } from '../types';

export class DepositFundsRequestDto implements DepositFundsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  userId: string;

  @ValidateNested()
  @Type(() => CreateOnrampSwapDto)
  @ApiProperty({ type: CreateOnrampSwapDto })
  fiat_deposit?: CreateOnrampSwapDto;
}
