import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsArray,
  IsNotEmpty,
  ArrayMaxSize,
  ArrayMinSize,
  MaxLength,
  MinLength,
  ValidateNested,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  ChamaMemberRole,
  type ChamaInvite,
  type ChamaMember,
  type ChamaUpdates,
  type PaginatedRequest,
} from '../types';
import { IsOptionalUUID, PaginatedRequestDto } from './lib.dto';

/**
 * DTOs for Chamas Module - REST Compliant
 *
 * These DTOs follow REST principles where resource identifiers
 * are provided via URL path parameters.
 *
 * - Chama ID and member IDs in URL paths for resource operations
 * - Request bodies only contain data to be created/updated
 * - Follows proper REST resource hierarchy
 */

/**
 * Helper decorators
 */
const IsChamaName = (isOptional = false) => {
  return (target: any, propertyKey: string) => {
    IsString()(target, propertyKey);
    if (!isOptional) IsNotEmpty()(target, propertyKey);
    if (isOptional) IsOptional()(target, propertyKey);
    MinLength(3)(target, propertyKey);
    MaxLength(50)(target, propertyKey);
    Transform(({ value }) => value?.trim())(target, propertyKey);
  };
};

const IsMembers = (minSize: number, maxSize: number, isOptional = false) => {
  return (target: any, propertyKey: string) => {
    IsArray()(target, propertyKey);
    if (isOptional) IsOptional()(target, propertyKey);
    ValidateNested({ each: true })(target, propertyKey);
    ArrayMinSize(minSize)(target, propertyKey);
    ArrayMaxSize(maxSize)(target, propertyKey);
    Type(() => ChamaMemberDto)(target, propertyKey);
  };
};

const IsInvites = (minSize: number, maxSize: number, isOptional = false) => {
  return (target: any, propertyKey: string) => {
    IsArray()(target, propertyKey);
    if (isOptional) IsOptional()(target, propertyKey);
    ValidateNested({ each: true })(target, propertyKey);
    ArrayMinSize(minSize)(target, propertyKey);
    ArrayMaxSize(maxSize)(target, propertyKey);
    Type(() => ChamaInviteDto)(target, propertyKey);
  };
};

/**
 * Chama member DTO
 */
export class ChamaMemberDto implements ChamaMember {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ChamaMemberRole, { each: true })
  @Transform(({ value }) => [...new Set(value)])
  @ApiProperty({
    example: [ChamaMemberRole.Member],
    enum: ChamaMemberRole,
    isArray: true,
  })
  roles: ChamaMemberRole[];
}

/**
 * Chama invite DTO
 */
export class ChamaInviteDto implements ChamaInvite {
  @IsOptional()
  @IsString()
  @ApiProperty({ example: '+254712345678', required: false })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'npub1...', required: false })
  nostrNpub?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ChamaMemberRole, { each: true })
  @Transform(({ value }) => [...new Set(value)])
  @ApiProperty({
    example: [ChamaMemberRole.Member],
    enum: ChamaMemberRole,
    isArray: true,
  })
  roles: ChamaMemberRole[];
}

/**
 * DTO for creating a chama
 * Used with: POST /api/chamas
 * Note: createdBy can be derived from authenticated user context
 */
export class CreateChamaDto {
  @IsChamaName()
  @ApiProperty({ example: 'Kenya Bitcoiners' })
  name: string;

  @IsChamaName(true)
  @ApiProperty({ example: 'We stack and buidl in Bitcoin', required: false })
  description?: string;

  @IsMembers(0, 100, true)
  @ApiProperty({
    type: [ChamaMemberDto],
    example: [
      {
        userId: '43040650-5090-4dd4-8e93-8fd342533e7c',
        roles: [ChamaMemberRole.Member, ChamaMemberRole.Admin],
      },
    ],
    description: 'Initial members to add to the chama',
    required: false,
  })
  members?: ChamaMember[];

  @IsInvites(0, 100, true)
  @ApiProperty({
    type: [ChamaInviteDto],
    description: 'Initial invitations to send',
    required: false,
  })
  invites?: ChamaInvite[];
}

/**
 * DTO for updating a chama
 * Used with: PATCH /api/chamas/:chamaId
 */
export class UpdateChamaDto {
  @IsChamaName(true)
  @ApiProperty({ example: 'Kenya Bitcoiners', required: false })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @ApiProperty({ example: 'We stack and buidl in Bitcoin', required: false })
  description?: string;

  @IsMembers(0, 100, true)
  @ApiProperty({
    type: [ChamaMemberDto],
    example: [
      {
        userId: '43040650-5090-4dd4-8e93-8fd342533e7c',
        roles: [ChamaMemberRole.Member],
      },
    ],
    description: 'Members to add to the chama',
    required: false,
  })
  addMembers?: ChamaMember[];

  @IsMembers(0, 100, true)
  @ApiProperty({
    type: [ChamaMemberDto],
    example: [
      {
        userId: '43040650-5090-4dd4-8e93-8fd342533e7c',
        roles: [ChamaMemberRole.Member, ChamaMemberRole.Admin],
      },
    ],
    description: 'Update roles for existing members',
    required: false,
  })
  updateMembers?: ChamaMember[];
}

/**
 * DTO for finding a single chama
 * Used by services to locate a chama by ID
 */
export class FindChamaDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
    description: 'Chama ID',
  })
  chamaId: string;
}

/**
 * DTO for filtering chamas (query parameters)
 * Used with: GET /api/chamas
 */
export class FilterChamasQueryDto {
  @IsOptionalUUID()
  @ApiProperty({
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
    required: false,
    description: 'Filter by creator user ID',
  })
  createdBy?: string;

  @IsOptionalUUID()
  @ApiProperty({
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
    required: false,
    description: 'Filter by member user ID',
  })
  memberId?: string;

  @IsOptional()
  @ApiProperty({
    type: Number,
    required: false,
    description: 'Page number for pagination',
    example: 0,
  })
  page?: number;

  @IsOptional()
  @ApiProperty({
    type: Number,
    required: false,
    description: 'Number of items per page',
    example: 10,
  })
  size?: number;
}

/**
 * DTO for filtering chamas (internal service use)
 * Includes pagination object for service layer
 */
export class FilterChamasDto {
  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  pagination?: PaginatedRequestDto;
}

/**
 * DTO for inviting members
 * Used with: POST /api/chamas/:chamaId/invites
 */
export class InviteMembersDto {
  @IsInvites(1, 100)
  @ApiProperty({
    type: [ChamaInviteDto],
    description: 'Members to invite to the chama',
  })
  invites: ChamaInvite[];
}

/**
 * DTO for adding members
 * Used with: POST /api/chamas/:chamaId/members
 * For directly adding members (not through invites)
 */
export class AddMembersDto {
  @IsMembers(1, 100)
  @ApiProperty({
    type: [ChamaMemberDto],
    description: 'Members to add to the chama',
  })
  members: ChamaMember[];
}

/**
 * DTO for updating a member's roles
 * Used with: PATCH /api/chamas/:chamaId/members/:memberId
 */
export class UpdateMemberRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ChamaMemberRole, { each: true })
  @Transform(({ value }) => [...new Set(value)])
  @ApiProperty({
    example: [ChamaMemberRole.Member, ChamaMemberRole.Admin],
    enum: ChamaMemberRole,
    isArray: true,
    description: 'New roles for the member',
  })
  roles: ChamaMemberRole[];
}
