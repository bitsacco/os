import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  Bolt11InvoiceDto,
  OfframpSwapTargetDto,
  OnrampSwapSourceDto,
} from './swap.dto';
import {
  DepositFundsRequest,
  WithdrawFundsRequest,
  UserTxsRequest,
  UpdateTxRequest,
  SolowalletTxUpdates,
  TransactionStatus,
  ContinueTxRequest,
  FindTxRequest,
} from '../types';
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

export class WithdrawFundsRequestDto implements WithdrawFundsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  userId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @ApiProperty({ example: 2 })
  amountFiat: number;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference: string;

  @ValidateNested()
  @Type(() => OfframpSwapTargetDto)
  @ApiProperty({ type: OfframpSwapTargetDto })
  offramp?: OfframpSwapTargetDto;

  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto })
  lightning?: Bolt11InvoiceDto;
}

export class UserTxsRequestDto implements UserTxsRequest {
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

class SolowalletTxUpdatesDto implements SolowalletTxUpdates {
  @IsOptional()
  @IsEnum(TransactionStatus)
  @ApiProperty({ enum: TransactionStatus })
  status?: TransactionStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto })
  lightning?: Bolt11InvoiceDto;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference: string;
}

export class UpdateTxDto implements UpdateTxRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '4a4b4c4d-cb98-40b1-9ed2-a13006a9f670' })
  txId: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => SolowalletTxUpdatesDto)
  @ApiProperty({ type: SolowalletTxUpdatesDto })
  updates: SolowalletTxUpdatesDto;
}

export class ContinueTxRequestDto implements ContinueTxRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  userId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '35f47ebd-599e-4334-a741-67f3495995e3' })
  txId: string;

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

export class FindTxRequestDto implements FindTxRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: 'c7137197-a6dc-46c3-98bd-9dc3a7d003a1' })
  txId: string;
}
