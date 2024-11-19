import {
  IsBoolean,
  IsString,
  IsNotEmpty,
  IsDefined,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ConfigureNostrRelaysRequest, NostrRelay } from '../types';

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
