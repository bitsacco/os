import {
  IsBoolean,
  IsString,
  IsNotEmpty,
  IsDefined,
  ValidateNested,
  IsOptional,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ConfigureNostrRelaysRequest, NostrDirectMessageRequest, NostrRecipient, NostrRelay } from '../types';

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

class NostrRelayDto implements NostrRelay {
  @IsNotEmpty()
  @IsString()
  @Matches(/^wss?:\/\/.+/, {
    message: 'Socket must be a valid WebSocket URL (ws:// or wss://)',
  })
  @Type(() => String)
  @ApiProperty()
  socket: string;

  @IsBoolean()
  @Type(() => Boolean)
  @ApiProperty()
  read: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  @ApiProperty()
  write: boolean;
}

export class ConfigureNostrRelaysDto implements ConfigureNostrRelaysRequest {
  @IsDefined()
  @ValidateNested({ each: true })
  @Type(() => NostrRelayDto)
  @ApiProperty({ type: [NostrRelayDto] })
  relays: NostrRelayDto[];
}
