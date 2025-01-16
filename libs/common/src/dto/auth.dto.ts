import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  // IsPhoneNumber,
  IsString,
  Validate,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  AuthRequest,
  IsStringifiedNumberConstraint,
  LoginUserRequest,
  RegisterUserRequest,
  Role,
  VerifyUserRequest,
} from '../types';

class AuthRequestBase {
  @IsNotEmpty()
  @IsString()
  @Validate(IsStringifiedNumberConstraint, [{ digits: 6, positive: true }])
  @ApiProperty({ example: '000000' })
  pin: string;

  @IsOptional()
  @IsString()
  // @IsPhoneNumber()
  @ApiProperty({
    example: '254700000000',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'npub17k76drpaeaungjltz9zlrr89ua0rlawgzs8fasaar49w0mnytrssgtk09g',
  })
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
  // @IsEnum({ each: true, type: Role })
  @ApiProperty({
    type: [Role],
    enum: Role,
    isArray: true,
  })
  roles: Role[];
}

export class VerifyUserRequestDto implements VerifyUserRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  // @IsPhoneNumber()
  @ApiProperty({
    example: '254700000000',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'npub17k76drpaeaungjltz9zlrr89ua0rlawgzs8fasaar49w0mnytrssgtk09g',
  })
  npub?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Validate(IsStringifiedNumberConstraint, [{ digits: 6, positive: true }])
  @ApiProperty({ example: '123456' })
  otp?: string;
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

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  // @IsPhoneNumber()
  @ApiProperty({
    example: '254700000000',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'npub17k76drpaeaungjltz9zlrr89ua0rlawgzs8fasaar49w0mnytrssgtk09g',
  })
  npub?: string;
}
