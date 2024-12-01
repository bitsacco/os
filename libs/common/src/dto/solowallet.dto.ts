import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OnrampSwapSourceDto } from './swap.dto';
import { DepositFundsRequest, FindUserTxsRequest } from '../types';
import { PaginatedRequestDto } from './lib.dto';

export class DepositFundsRequestDto implements DepositFundsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  userId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @ApiProperty({ example: 2 })
  amountFiat: number;

  @ValidateNested()
  @Type(() => OnrampSwapSourceDto)
  @ApiProperty({ type: OnrampSwapSourceDto })
  onramp?: OnrampSwapSourceDto;
}

export class FindUserTxsRequestDto implements FindUserTxsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  userId: string;

  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination: PaginatedRequestDto;
}
