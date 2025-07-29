import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export const PhoneDecorators = () => {
  return applyDecorators(
    IsOptional(),
    IsString(),
    IsNotEmpty(),
    // @IsPhoneNumber()
    ApiProperty({
      example: '+254700123456',
    }),
  );
};

export const NpubDecorators = () => {
  return applyDecorators(
    IsOptional(),
    IsString(),
    IsNotEmpty(),
    ApiProperty({
      example:
        'npub17k76drpaeaungjltz9zlrr89ua0rlawgzs8fasaar49w0mnytrssgtk09g',
    }),
  );
};
