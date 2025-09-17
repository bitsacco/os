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
  type InviteMembersRequest,
  type CreateChamaRequest,
  type FilterChamasRequest,
  type FindChamaRequest,
  type PaginatedRequest,
} from '../types';
import { NpubDecorators, PhoneDecorators } from './decorators';
import { IsOptionalUUID, IsRequiredUUID, PaginatedRequestDto } from './lib.dto';

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

export class ChamaMemberDto implements ChamaMember {
  @IsRequiredUUID()
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

export class ChamaInviteDto implements ChamaInvite {
  @PhoneDecorators()
  phoneNumber?: string;

  @NpubDecorators()
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

export class CreateChamaDto implements CreateChamaRequest {
  @IsChamaName()
  @ApiProperty({ example: 'Kenya Bitcoiners' })
  name: string;

  @IsChamaName()
  @ApiProperty({ example: 'Kenya Bitcoiners' })
  description?: string;

  @IsMembers(1, 100)
  @ApiProperty({
    type: [ChamaMemberDto],
    example: [
      {
        userId: '43040650-5090-4dd4-8e93-8fd342533e7c',
        roles: [ChamaMemberRole.Member, ChamaMemberRole.Admin],
      },
    ],
  })
  members: ChamaMember[];

  @IsInvites(0, 100)
  @ApiProperty({
    type: [ChamaInviteDto],
  })
  invites: ChamaInvite[];

  @IsRequiredUUID()
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  createdBy: string;
}

export class ChamaUpdatesDto implements ChamaUpdates {
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
  })
  addMembers: ChamaMember[];

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
  })
  updateMembers: ChamaMember[];
}

export class FindChamaDto implements FindChamaRequest {
  @IsRequiredUUID()
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  chamaId: string;
}

export class FilterChamasDto implements FilterChamasRequest {
  @IsOptionalUUID()
  @ApiProperty({
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
    required: false,
  })
  createdBy?: string;

  @IsOptionalUUID()
  @ApiProperty({
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
    required: false,
  })
  memberId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination?: PaginatedRequest;
}

export class MemberInvitesDto implements Pick<InviteMembersRequest, 'invites'> {
  @IsInvites(1, 100, true)
  @ApiProperty({
    type: [ChamaInviteDto],
  })
  invites: ChamaInvite[];
}
