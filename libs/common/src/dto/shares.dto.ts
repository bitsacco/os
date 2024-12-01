import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsPositive, IsNumber } from 'class-validator';
import { BuySharesRequest, GetShareDetailRequest } from '@bitsacco/common';
import { ApiProperty } from '@nestjs/swagger';

export class GetShareDetailDto implements GetShareDetailRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  userId: string;
}

export class BuySharesDto implements BuySharesRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  userId: string;

  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty()
  quantity: number;
}
