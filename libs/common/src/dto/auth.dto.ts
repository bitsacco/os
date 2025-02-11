import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Validate,
  ValidateNested,
} from 'class-validator';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  AuthRequest,
  IsStringifiedNumberConstraint,
  LoginUserRequest,
  type Nostr,
  type Phone,
  type Profile,
  RecoverUserRequest,
  RegisterUserRequest,
  Role,
  UserUpdates,
  VerifyUserRequest,
} from '../types';
import { PhoneDecorators, NpubDecorators } from './decorators';

const PinDecorators = () => {
  return applyDecorators(
    IsNotEmpty(),
    IsString(),
    Validate(IsStringifiedNumberConstraint, [{ digits: 6, positive: true }]),
    ApiProperty({ example: '000000' }),
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

class PhoneDto implements Pick<Phone, 'number'> {
  @PhoneDecorators()
  number: string;
}

class NostrDto implements Pick<Nostr, 'npub'> {
  @NpubDecorators()
  npub: string;
}

class ProfileDto implements Profile {
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Users name or nym',
    required: false,
    example: 'satoshi',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  @ApiProperty({
    description: 'Users avatar url',
    required: false,
    example: 'https://example.com/avatar.jpg',
  })
  avatarUrl?: string;
}

export class UserUpdatesDto implements UserUpdates {
  @IsOptional()
  @ValidateNested()
  @Type(() => PhoneDto)
  @ApiProperty({ type: PhoneDto, required: false })
  phone?: Phone;

  @IsOptional()
  @ValidateNested()
  @Type(() => NostrDto)
  @ApiProperty({ type: NostrDto, required: false })
  nostr?: Nostr;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileDto)
  @ApiProperty({ type: ProfileDto, required: false })
  profile?: Profile;

  @IsArray()
  @IsEnum(Role, { each: true })
  @ApiProperty({ type: [Role], enum: Role })
  roles: Role[];
}
