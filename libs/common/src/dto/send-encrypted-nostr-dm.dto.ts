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
  @ApiProperty({
    example: 'npub17k76drpaeaungjltz9zlrr89ua0rlawgzs8fasaar49w0mnytrssgtk09g',
  })
  npub: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '' })
  pubkey: string;
}

export class SendEncryptedNostrDmDto implements NostrDirectMessageRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: 'hello bitsacco' })
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
