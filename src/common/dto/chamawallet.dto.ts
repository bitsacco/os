import { Type } from 'class-transformer';
import {
  IsNumber,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  IsString,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';
import {
  Review,
  ChamaTxStatus,
  type ChamaTxReview,
  type ChamaTxsFilterRequest,
  type ChamaTxUpdateRequest,
  type ChamaTxUpdates,
  type PaginatedRequest,
  type ChamaContinueWithdrawRequest,
  type ChamaWithdrawRequest,
  type ChamaContinueDepositRequest,
  type OnrampSwapSource,
  type ChamaDepositRequest,
  type ChamaTxMetaRequest,
  type ChamaTxContext,
  type BulkChamaTxMetaRequest,
} from '../types';
import {
  Bolt11InvoiceDto,
  OfframpSwapTargetDto,
  OnrampSwapSourceDto,
} from './swap.dto';
import { IsRequiredUUID, PaginatedRequestDto } from './lib.dto';

const UUIDDecorator = () => {
  return applyDecorators(
    IsRequiredUUID(),
    ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' }),
  );
};

const AmountFiatDecorator = () => {
  return applyDecorators(IsNumber(), ApiProperty({ example: 2 }));
};

const ReferenceDecorator = () => {
  return applyDecorators(
    IsString(),
    Type(() => String),
    ApiProperty(),
  );
};

const PaginationDecorator = () => {
  return applyDecorators(
    IsOptional(),
    ValidateNested(),
    Type(() => PaginatedRequestDto),
    ApiProperty({ type: PaginatedRequestDto }),
  );
};

class ChamaTxContextDto implements ChamaTxContext {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ required: false })
  sharesSubscriptionTracker?: string;
}

class PaginationDto {
  @PaginationDecorator()
  pagination?: PaginatedRequest;
}

class ChamaBaseDto extends PaginationDto {
  @UUIDDecorator()
  chamaId: string;
}

class ChamaTransactionBaseDto extends ChamaBaseDto {
  @AmountFiatDecorator()
  amountFiat: number;

  @ReferenceDecorator()
  reference: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Idempotency key to prevent duplicate transactions',
    example: 'chama-withdraw-2024-01-15-unique-id',
    required: false,
  })
  idempotencyKey?: string;
}

class ChamaMemberBaseDto extends ChamaTransactionBaseDto {
  @UUIDDecorator()
  memberId: string;
}

export class ChamaDepositDto
  extends ChamaMemberBaseDto
  implements ChamaDepositRequest
{
  @IsOptional()
  @ValidateNested()
  @Type(() => OnrampSwapSourceDto)
  @ApiProperty({ type: OnrampSwapSourceDto })
  onramp?: OnrampSwapSource;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChamaTxContextDto)
  @ApiProperty({ type: ChamaTxContextDto })
  context?: ChamaTxContext;
}

export class ChamaContinueDepositDto
  extends ChamaTransactionBaseDto
  implements ChamaContinueDepositRequest
{
  @UUIDDecorator()
  txId: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => OnrampSwapSourceDto)
  @ApiProperty({ type: OnrampSwapSourceDto })
  onramp?: OnrampSwapSource;
}

export class ChamaWithdrawDto
  extends ChamaMemberBaseDto
  implements ChamaWithdrawRequest {}

export class ChamaContinueWithdrawDto
  extends ChamaBaseDto
  implements ChamaContinueWithdrawRequest
{
  @UUIDDecorator()
  memberId: string;

  @UUIDDecorator()
  txId: string;

  @ValidateNested()
  @Type(() => OfframpSwapTargetDto)
  @ApiProperty({ type: OfframpSwapTargetDto, required: false })
  offramp?: OfframpSwapTargetDto;

  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto, required: false })
  lightning?: Bolt11InvoiceDto;

  @IsOptional()
  @IsNotEmpty()
  @ApiProperty({ required: false })
  lnurlRequest?: boolean;
}

export class ChamaTxReviewDto implements ChamaTxReview {
  @UUIDDecorator()
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
  @ApiProperty({ type: [ChamaTxReviewDto] })
  reviews: ChamaTxReview[];

  @IsOptional()
  @ReferenceDecorator()
  reference?: string;
}

export class UpdateChamaTransactionDto
  extends ChamaBaseDto
  implements ChamaTxUpdateRequest
{
  @UUIDDecorator()
  txId: string;

  @ValidateNested()
  @Type(() => ChamaTxUpdatesDto)
  @ApiProperty({ type: ChamaTxUpdatesDto })
  updates: ChamaTxUpdates;
}

export class FilterChamaTransactionsDto
  extends PaginationDto
  implements ChamaTxsFilterRequest
{
  @IsOptional()
  @UUIDDecorator()
  memberId?: string;

  @IsOptional()
  @UUIDDecorator()
  chamaId?: string;
}

export class ChamaTxMetaRequestDto
  implements Omit<ChamaTxMetaRequest, 'chamaId'>
{
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    description: 'Optional array of member IDs to include for each chama',
    type: [String],
    required: false,
    example: ['63040650-5090-4dd4-8e93-8fd342533e9c'],
  })
  selectMemberIds: string[];

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: 'If true, skip member meta and only return group meta',
    required: false,
    type: Boolean,
    example: false,
  })
  skipMemberMeta?: boolean;
}

export class BulkChamaTxMetaRequestDto implements BulkChamaTxMetaRequest {
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    description: 'Array of chama IDs to aggregate wallet meta for',
    type: [String],
    example: [
      '43040650-5090-4dd4-8e93-8fd342533e7c',
      '53040650-5090-4dd4-8e93-8fd342533e8c',
    ],
  })
  chamaIds: string[];

  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    description: 'Optional array of member IDs to include for each chama',
    type: [String],
    required: false,
    example: ['63040650-5090-4dd4-8e93-8fd342533e9c'],
  })
  selectMemberIds: string[];

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: 'If true, skip member meta and only return group meta',
    required: false,
    type: Boolean,
    example: false,
  })
  skipMemberMeta?: boolean;
}
