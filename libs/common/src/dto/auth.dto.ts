import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  AuthRequest,
  IsStringifiedNumberConstraint,
  LoginUserRequest,
  RecoverUserRequest,
  RegisterUserRequest,
  Role,
  VerifyUserRequest,
} from '../types';

const PinDecorators = () => {
  return applyDecorators(
    IsNotEmpty(),
    IsString(),
    Validate(IsStringifiedNumberConstraint, [{ digits: 6, positive: true }]),
    ApiProperty({ example: '000000' }),
  );
};

const PhoneDecorators = () => {
  return applyDecorators(
    IsOptional(),
    IsString(),
    IsNotEmpty(),
    // @IsPhoneNumber()
    ApiProperty({
      example: '+254700000000',
    }),
  );
};

const NpubDecorators = () => {
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

class AuthRequestBase {
  @PinDecorators()
  pin: string;

  @PhoneDecorators()
  phone?: string;

  @NpubDecorators()
  npub?: string;
}

export class LoginUserRequestDto
  extends AuthRequestBase
  implements LoginUserRequest {}

export class RegisterUserRequestDto
  extends AuthRequestBase
  implements RegisterUserRequest
{
  @IsArray()
  @ApiProperty({
    type: [Role],
    enum: Role,
    isArray: true,
  })
  roles: Role[];
}

export class VerifyUserRequestDto implements VerifyUserRequest {
  @PhoneDecorators()
  phone?: string;

  @NpubDecorators()
  npub?: string;

  @IsOptional()
  @PinDecorators()
  otp?: string;
}

export class RecoverUserRequestDto implements RecoverUserRequest {
  @PhoneDecorators()
  phone?: string;

  @NpubDecorators()
  npub?: string;
}

export class AuthRequestDto implements AuthRequest {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  token: string;
}

export class FindUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id?: string;

  @PhoneDecorators()
  phone?: string;

  @NpubDecorators()
  npub?: string;
}
