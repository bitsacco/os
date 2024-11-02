import { ApiProperty } from '@nestjs/swagger';

export class QuoteDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  refreshIfExpired: boolean;
}
