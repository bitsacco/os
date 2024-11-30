import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateOnrampSwapDto } from './swap.dto';
import { DepositFundsRequest, FindUserTxsRequest } from '../types';
import { PaginatedRequestDto } from './lib.dto';

export class DepositFundsRequestDto implements DepositFundsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  userId: string;

  @ValidateNested()
  @Type(() => CreateOnrampSwapDto)
  @ApiProperty({ type: CreateOnrampSwapDto })
  fiatDeposit?: CreateOnrampSwapDto;
}

export class FindUserTxsRequestDto implements FindUserTxsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  userId: string;

  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination: PaginatedRequestDto;
}
