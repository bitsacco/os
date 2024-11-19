import {
  IsBoolean,
  IsString,
  IsNotEmpty,
  IsDefined,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NostrDirectMessageRequest, NostrRecipient } from '../types';

class NostrRecipientDto implements NostrRecipient {
  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  npub: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  pubkey: string;
}

export class SendEncryptedNostrDmDto implements NostrDirectMessageRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty()
  message: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => NostrRecipientDto)
  @ApiProperty({ type: NostrRecipientDto })
  recipient: NostrRecipientDto;

  @IsBoolean()
  @Type(() => Boolean)
  @ApiProperty()
  retry: boolean;
}
