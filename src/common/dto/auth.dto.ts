import {
  IsArray,
  IsBoolean,
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
  IsStringifiedNumberConstraint,
  Role,
  type AuthRequest,
  type LoginUserRequest,
  type Nostr,
  type Phone,
  type Profile,
  type RecoverUserRequest,
  type RefreshTokenRequest,
  type RegisterUserRequest,
  type RevokeTokenRequest,
  type RevokeTokenResponse,
  type TokensResponse,
  type UpdateUserRequest,
  type UserUpdates,
  type VerifyUserRequest,
} from '../types';
import { PhoneDecorators, NpubDecorators } from './decorators';

/**
 * DTOs for Auth Module - REST Compliant
 *
 * These DTOs follow REST principles where resource identifiers
 * are provided via URL path parameters.
 *
 * - User ID is in URL paths for update operations
 * - Request bodies only contain data to be created/updated
 * - Follows proper REST resource hierarchy
 */

/**
 * Pin decorators helper
 */
const PinDecorators = () => {
  return applyDecorators(
    IsString(),
    Validate(IsStringifiedNumberConstraint, [{ digits: 6, positive: true }]),
    ApiProperty({ example: '123456' }),
  );
};

/**
 * Base class for authentication requests
 */
class AuthRequestBase {
  @PinDecorators()
  pin: string;

  @PhoneDecorators()
  phone?: string;

  @NpubDecorators()
  npub?: string;
}

/**
 * DTO for login requests
 */
export class LoginUserRequestDto
  extends AuthRequestBase
  implements LoginUserRequest {}

/**
 * DTO for user registration
 */
export class RegisterUserRequestDto
  extends AuthRequestBase
  implements RegisterUserRequest
{
  @IsArray()
  @ApiProperty({
    type: [Role],
    enum: Role,
    isArray: true,
    description: 'Only Role.Member (0) is allowed for user registration',
  })
  @IsEnum(Role, {
    each: true,
    message: 'Only the Member role is allowed during registration',
  })
  roles: Role[];
}

/**
 * DTO for user verification
 */
export class VerifyUserRequestDto implements VerifyUserRequest {
  @PhoneDecorators()
  phone?: string;

  @NpubDecorators()
  npub?: string;

  @PinDecorators()
  otp?: string;
}

/**
 * DTO for user recovery
 */
export class RecoverUserRequestDto implements RecoverUserRequest {
  @PinDecorators()
  pin: string;

  @PhoneDecorators()
  @IsOptional()
  phone?: string;

  @NpubDecorators()
  npub?: string;

  @PinDecorators()
  otp?: string;
}

/**
 * DTO for auth request (access token validation)
 */
export class AuthRequestDto implements AuthRequest {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  accessToken: string;
}

/**
 * DTO for finding users
 */
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

/**
 * Phone DTO
 */
class PhoneDto implements Pick<Phone, 'number'> {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '+254712345678' })
  number: string;
}

/**
 * Nostr DTO
 */
class NostrDto implements Pick<Nostr, 'npub'> {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'npub1...' })
  npub: string;
}

/**
 * Profile DTO
 */
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

/**
 * User updates DTO
 */
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
  @ApiProperty({ type: [String], enum: Role, isArray: true })
  roles: Role[];
}

/**
 * DTO for updating user
 * Used with: PATCH /api/users/:userId
 *
 * Usage:
 *   PATCH /api/users/123
 *   Body: { ...updates }
 */
export class UpdateUserDto extends UserUpdatesDto {
  // Directly extends UserUpdatesDto
  // No need for nested 'updates' object
}

/**
 * Additional DTOs for potential future endpoints
 * These follow REST principles for user resource operations
 */

/**
 * DTO for partial user updates
 * Used with: PATCH /api/users/:userId/profile
 * Allows updating just the profile without touching roles
 */
export class UpdateUserProfileDto extends ProfileDto {}

/**
 * DTO for updating user roles
 * Used with: PUT /api/users/:userId/roles
 * Allows updating just the roles
 */
export class UpdateUserRolesDto {
  @IsArray()
  @IsEnum(Role, { each: true })
  @ApiProperty({
    type: [String],
    enum: Role,
    isArray: true,
    description: 'Complete list of roles to assign to the user',
  })
  roles: Role[];
}

/**
 * DTO for updating user phone
 * Used with: PATCH /api/users/:userId/phone
 * Allows updating just the phone number
 */
export class UpdateUserPhoneDto extends PhoneDto {}

/**
 * DTO for updating user Nostr identity
 * Used with: PATCH /api/users/:userId/nostr
 * Allows updating just the Nostr npub
 */
export class UpdateUserNostrDto extends NostrDto {}

/**
 * DTO for legacy update user request (includes userId in body)
 * Used by services that haven't migrated to REST pattern yet
 */
export class UpdateUserRequestDto implements UpdateUserRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UserUpdatesDto)
  @ApiProperty({ type: UserUpdatesDto, required: true })
  updates: UserUpdates;
}

/**
 * DTO for refresh token requests
 */
export class RefreshTokenRequestDto implements RefreshTokenRequest {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The refresh token to use for getting new tokens',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}

/**
 * DTO for tokens response
 */
export class TokensResponseDto implements TokensResponse {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The new access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The new refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}

/**
 * DTO for revoke token requests
 */
export class RevokeTokenRequestDto implements RevokeTokenRequest {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The refresh token to revoke',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}

/**
 * DTO for revoke token response
 */
export class RevokeTokenResponseDto implements RevokeTokenResponse {
  @IsBoolean()
  @ApiProperty({
    description: 'Whether the token was successfully revoked',
    example: true,
  })
  success: boolean;
}
