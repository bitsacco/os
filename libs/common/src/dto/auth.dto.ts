import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Validate,
} from 'class-validator';
import { CreateUserRequest, IsStringifiedNumberConstraint } from '../types';
import { Type } from 'class-transformer';

export class CreateUserRequestDto implements CreateUserRequest {
  @IsPhoneNumber()
  @IsOptional()
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Validate(IsStringifiedNumberConstraint)
  @Type(() => String)
  pin: string;

  @IsString()
  @IsOptional()
  npub: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  roles: string[];
}

export class GetUserDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
