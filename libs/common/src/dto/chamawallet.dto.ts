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
import { IsRequiredUUID, PaginatedRequestDto } from './lib.dto';
import {
  Review,
  ChamaTxStatus,
  type ChamaTxReview,
  type ChamaTxsFilterRequest,
  type ChamaTxUpdateRequest,
  type ChamaTxUpdates,
  type PaginatedRequest,
  type ChamaContinueWithdrawRequest,
  type Bolt11,
  type OfframpSwapTarget,
  type ChamaWithdrawRequest,
  type ChamaContinueDepositRequest,
  type OnrampSwapSource,
  type ChamaDepositRequest,
  type ChamaTxMetaRequest,
} from '../types';
import {
  Bolt11InvoiceDto,
  OfframpSwapTargetDto,
  OnrampSwapSourceDto,
} from './swap.dto';
import { applyDecorators } from '@nestjs/common';

const MemberIdDecorator = () => {
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

class ChamaBaseDto {
  @PaginationDecorator()
  pagination?: PaginatedRequest;
}

class ChamaTransactionBaseDto extends ChamaBaseDto {
  @AmountFiatDecorator()
  amountFiat: number;

  @ReferenceDecorator()
  reference: string;
}

class ChamaMemberBaseDto extends ChamaTransactionBaseDto {
  @MemberIdDecorator()
  memberId: string;

  @MemberIdDecorator()
  chamaId: string;
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
}

export class ChamaContinueDepositDto
  extends ChamaTransactionBaseDto
  implements ChamaContinueDepositRequest
{
  @MemberIdDecorator()
  txId: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => OnrampSwapSourceDto)
  @ApiProperty({ type: OnrampSwapSourceDto })
  onramp?: OnrampSwapSource;
}

export class ChamaWithdrawDto
  extends ChamaMemberBaseDto
  implements ChamaWithdrawRequest
{
  @ValidateNested()
  @Type(() => OfframpSwapTargetDto)
  @ApiProperty({ type: OfframpSwapTargetDto })
  offramp?: OfframpSwapTarget;

  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto })
  lightning?: Bolt11;
}

export class ChamaContinueWithdrawDto
  extends ChamaBaseDto
  implements ChamaContinueWithdrawRequest
{
  @MemberIdDecorator()
  txId: string;

  @AmountFiatDecorator()
  amountFiat: number;

  @ReferenceDecorator()
  reference?: string;

  @ValidateNested()
  @Type(() => OfframpSwapTargetDto)
  @ApiProperty({ type: OfframpSwapTargetDto })
  offramp?: OfframpSwapTarget;

  @ValidateNested()
  @Type(() => Bolt11InvoiceDto)
  @ApiProperty({ type: Bolt11InvoiceDto })
  lightning?: Bolt11;
}

export class ChamaTxReviewDto implements ChamaTxReview {
  @MemberIdDecorator()
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
  @MemberIdDecorator()
  txId: string;

  @ValidateNested()
  @Type(() => ChamaTxUpdatesDto)
  @ApiProperty({ type: ChamaTxUpdatesDto })
  updates: ChamaTxUpdates;
}

export class FilterChamaTransactionsDto
  extends ChamaBaseDto
  implements ChamaTxsFilterRequest
{
  @IsOptional()
  @MemberIdDecorator()
  memberId?: string;

  @IsOptional()
  @MemberIdDecorator()
  chamaId?: string;
}

export class AggregateChamaTransactionsDto implements ChamaTxMetaRequest {
  @IsArray()
  @IsString({ each: true })
  selectChamaId: string[];

  @IsArray()
  @IsString({ each: true })
  selectMemberId: string[];

  @IsOptional()
  @IsBoolean()
  skipMemberMeta?: boolean;
}
