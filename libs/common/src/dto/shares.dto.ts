import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsPositive,
  IsNumber,
  IsDateString,
} from 'class-validator';
import {
  OfferSharesRequest,
  SubscribeSharesRequest,
  TransferSharesRequest,
  UserSharesTxsRequest,
} from '@bitsacco/common';
import { ApiProperty } from '@nestjs/swagger';

export class OfferSharesDto implements OfferSharesRequest {
  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ description: 'Amount of shares to issue', example: 1000 })
  quantity: number;

  @IsNotEmpty()
  @IsDateString()
  @Type(() => String)
  @ApiProperty({ description: 'Start date of availability (ISO 8601 format)', example: '2024-12-30T12:19:04.077Z' })
  availableFrom: string;

  @IsNotEmpty()
  @IsDateString()
  @Type(() => String)
  @ApiProperty({ description: 'End date of availability (ISO 8601 format)', example: '2025-12-30T12:19:04.077Z' })
  availableTo?: string;
}

export class SubscribeSharesDto implements SubscribeSharesRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  userId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '3e158dfd-cb98-40b1-9ed2-a13006a9f430' })
  offerId: string;

  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty()
  quantity: number;
}

export class TransferSharesDto implements TransferSharesRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  fromUserId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '8b158dfd-cb98-40b1-9ed2-a13006a9f671' })
  toUserId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '3e158dfd-cb98-40b1-9ed2-a13006a9f430' })
  sharesId: string;

  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty()
  quantity: number;
}

export class UserSharesDto implements UserSharesTxsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  userId: string;
}
