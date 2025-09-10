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
  DepositFundsRequest,
  ContinueDepositFundsRequest,
  ContinueWithdrawFundsRequest,
  WithdrawFundsRequest,
  UserTxsRequest,
  UpdateTxRequest,
  SolowalletTxUpdates,
  TransactionStatus,
  FindTxRequest,
} from '../types';
import {
  Bolt11InvoiceDto,
  OfframpSwapTargetDto,
  OnrampSwapSourceDto,
} from './swap.dto';
import { PaginatedRequestDto } from './lib.dto';
import { IsEitherAmountFiatOrMsats } from './amount.validator';

export class DepositFundsRequestDto implements DepositFundsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @ApiProperty({ example: 2, required: false })
  @IsEitherAmountFiatOrMsats()
  amountFiat?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @ApiProperty({
    example: 10000,
    description: 'Amount in millisatoshis',
    required: false,
  })
  amountMsats?: number;

  @ValidateNested()
  @Type(() => OnrampSwapSourceDto)
  @ApiProperty({ type: OnrampSwapSourceDto })
  onramp?: OnrampSwapSourceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequestDto;
}

export class ContinueDepositFundsRequestDto
  implements ContinueDepositFundsRequest
{
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '35f47ebd-599e-4334-a741-67f3495995e3' })
  txId: string;

  @IsNumber()
  @Min(1)
  @ApiProperty({ example: 2 })
  amountFiat: number;

  @ValidateNested()
  @Type(() => OnrampSwapSourceDto)
  @ApiProperty({ type: OnrampSwapSourceDto })
  onramp?: OnrampSwapSourceDto;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequestDto;
}

export class WithdrawFundsRequestDto implements WithdrawFundsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 2 })
  amountFiat: number;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfframpSwapTargetDto)
  @ApiProperty({ type: OfframpSwapTargetDto, required: false })
  offramp?: OfframpSwapTargetDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto, required: false })
  lightning?: Bolt11InvoiceDto;

  @IsOptional()
  @Type(() => Boolean)
  @ApiProperty({
    type: Boolean,
    required: false,
    description: 'request LNURL withdrawal',
  })
  lnurlRequest?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequestDto;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Lightning address for withdrawal (e.g., user@wallet.com)',
    example: 'alice@getalby.com',
    required: false,
  })
  lightningAddress?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Idempotency key to prevent duplicate withdrawals',
    example: 'withdraw-2024-01-15-unique-id',
    required: false,
  })
  idempotencyKey?: string;
}

export class ContinueWithdrawFundsRequestDto
  implements ContinueWithdrawFundsRequest
{
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '4a4b4c4d-cb98-40b1-9ed2-a13006a9f670' })
  txId: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 2 })
  amountFiat: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfframpSwapTargetDto)
  @ApiProperty({ type: OfframpSwapTargetDto, required: false })
  offramp?: OfframpSwapTargetDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto, required: false })
  lightning?: Bolt11InvoiceDto;

  @IsOptional()
  @Type(() => Boolean)
  @ApiProperty({
    type: Boolean,
    required: false,
    description: 'request LNURL withdrawal',
  })
  lnurlRequest?: boolean;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequestDto;
}

export class UserTxsRequestDto implements UserTxsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequestDto;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequestDto;
}

export class FindTxRequestDto implements FindTxRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: 'c7137197-a6dc-46c3-98bd-9dc3a7d003a1' })
  txId: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
    description: 'User ID for ownership validation',
  })
  userId?: string;
}

export class LnUrlWithdrawStatusRequestDto {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ description: 'ID of the withdrawal to check' })
  withdrawId: string;
}

export class PayToExternalAddressRequestDto {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Lightning address to pay to (e.g., user@wallet.com)',
    example: 'alice@getalby.com',
  })
  lightningAddress: string;

  @IsNumber()
  @Min(1)
  @ApiProperty({
    description: 'Amount in satoshis to send',
    example: 1000,
  })
  amountSats: number;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Optional comment for the payment',
    example: 'Payment for services',
    required: false,
  })
  comment?: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    description: 'Reference for the transaction',
    example: 'External payment to alice@getalby.com',
  })
  reference: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Idempotency key to prevent duplicate payments',
    example: 'pay-external-2024-01-15-unique-id',
    required: false,
  })
  idempotencyKey?: string;
}

export class PayToExternalAddressResponseDto {
  @ApiProperty({
    description: 'Unique transaction ID',
    example: '4a4b4c4d-cb98-40b1-9ed2-a13006a9f670',
  })
  txId: string;

  @ApiProperty({
    description: 'Whether the payment was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Amount sent in satoshis',
    example: 1000,
  })
  amountSats: number;

  @ApiProperty({
    description: 'Fee paid in satoshis',
    example: 5,
  })
  feeSats: number;

  @ApiProperty({
    description: 'Total amount withdrawn (amount + fee) in satoshis',
    example: 1005,
  })
  totalAmountSats: number;

  @ApiProperty({
    description: 'Lightning address that was paid',
    example: 'alice@getalby.com',
  })
  lightningAddress: string;

  @ApiProperty({
    description: 'Operation ID from the lightning network',
    example: 'op_123456789',
    required: false,
  })
  operationId?: string;

  @ApiProperty({
    description: 'Error message if payment failed',
    required: false,
  })
  error?: string;
}
