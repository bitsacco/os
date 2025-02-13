import { Type } from 'class-transformer';
import {
  IsNumber,
  IsEnum,
  IsOptional,
  ValidateNested,
  Min,
  IsArray,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsRequiredUUID, PaginatedRequestDto } from './lib.dto';
import {
  Review,
  ChamaTxStatus,
  type ChamaTxReview,
  type ChamaTxsFilterRequest,
  type ChamaTxUpdateRequest,
  type ChamaTxUpdates,
  type PaginatedRequest,
  ChamaContinueWithdrawRequest,
  Bolt11,
  OfframpSwapTarget,
  ChamaWithdrawRequest,
} from '../types';
import { Bolt11InvoiceDto, OfframpSwapTargetDto } from './swap.dto';

export class DepositDto {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  chamaId: string;

  @IsNumber()
  @Min(0)
  @ApiProperty({ example: 1000 })
  amount: number;

  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  userId: string;
}

export class ContinueDepositDto {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  transactionId: string;
}

export class ChamaWithdrawDto implements ChamaWithdrawRequest {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  memberId: string;

  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  chamaId: string;

  @IsNumber()
  @ApiProperty({ example: 2 })
  amountFiat: number;

  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference: string;

  @ValidateNested()
  @Type(() => OfframpSwapTargetDto)
  @ApiProperty({ type: OfframpSwapTargetDto })
  offramp?: OfframpSwapTarget;

  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto })
  lightning?: Bolt11;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequest;
}

export class ChamaContinueWithdrawDto implements ChamaContinueWithdrawRequest {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  txId: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 2 })
  amountFiat: number;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference: string;

  @ValidateNested()
  @Type(() => OfframpSwapTargetDto)
  @ApiProperty({ type: OfframpSwapTargetDto })
  offramp?: OfframpSwapTarget;

  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto })
  lightning?: Bolt11;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequest;
}

export class ChamaTxReviewDto implements ChamaTxReview {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  memberId: string;

  @IsOptional()
  @IsEnum(Review)
  @ApiProperty({ enum: Review })
  review: Review;
}

export class ChamaTxUpdatesDto implements ChamaTxUpdates {
  @IsOptional()
  @IsEnum(ChamaTxStatus)
  @ApiProperty({ enum: ChamaTxStatus })
  status?: ChamaTxStatus;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 2 })
  amountMsats?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChamaTxReviewDto)
  @ApiProperty({
    type: [ChamaTxReviewDto],
  })
  reviews: ChamaTxReview[];

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  reference?: string;
}

export class UpdateChamaTransactionDto implements ChamaTxUpdateRequest {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  txId: string;

  @ValidateNested()
  @Type(() => ChamaTxUpdatesDto)
  @ApiProperty({ type: ChamaTxUpdatesDto })
  updates: ChamaTxUpdates;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequest;
}

export class FilterChamaTransactionsDto implements ChamaTxsFilterRequest {
  @IsOptional()
  @IsRequiredUUID()
  @ApiProperty({
    example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670',
    required: false,
  })
  memberId?: string;

  @IsOptional()
  @IsRequiredUUID()
  @ApiProperty({
    example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670',
    required: false,
  })
  chamaId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequest;
}
