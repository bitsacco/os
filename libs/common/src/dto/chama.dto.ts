import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsArray,
  IsNotEmpty,
  ArrayMaxSize,
  ArrayMinSize,
  IsUUID,
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
  type JoinChamaRequest,
  type UpdateChamaRequest,
} from '../types';
import { NpubDecorators, PhoneDecorators } from './decorators';

// Decorator Factories
const IsRequiredUUID = () => {
  return (target: any, propertyKey: string) => {
    IsString()(target, propertyKey);
    IsNotEmpty()(target, propertyKey);
    IsUUID()(target, propertyKey);
  };
};

const IsOptionalUUID = () => {
  return (target: any, propertyKey: string) => {
    IsString()(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsUUID()(target, propertyKey);
  };
};

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

class ChamaMemberDto implements ChamaMember {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
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

class ChamaInviteDto implements ChamaInvite {
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
        userId: '7b158dfd-cb98-40b1-9ed2-a13006a9f670',
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
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  createdBy: string;
}

export class ChamaUpdatesDto implements ChamaUpdates {
  @IsChamaName(true)
  @ApiProperty({ example: 'Og Maxi Kenya Bitcoiners', required: false })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @ApiProperty({ example: 'We stack and buidl in Bitcoin', required: false })
  description?: string;

  @IsMembers(1, 100, true)
  @ApiProperty({
    type: [ChamaMemberDto],
    example: [
      {
        userId: '7b158dfd-cb98-40b1-9ed2-a13006a9f670',
        roles: [ChamaMemberRole.Member],
      },
    ],
  })
  members: ChamaMember[];
}

export class UpdateChamaDto implements UpdateChamaRequest {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  chamaId: string;

  @ValidateNested()
  @Type(() => ChamaUpdatesDto)
  @IsNotEmpty()
  @ApiProperty({ type: ChamaUpdatesDto })
  updates: ChamaUpdates;
}

export class FindChamaDto implements FindChamaRequest {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  chamaId: string;
}

export class FilterChamasDto implements FilterChamasRequest {
  @IsOptionalUUID()
  @ApiProperty({
    example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670',
    required: false,
  })
  createdBy?: string;

  @IsOptionalUUID()
  @ApiProperty({
    example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670',
    required: false,
  })
  memberId?: string;
}

export class JoinChamaDto implements JoinChamaRequest {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  chamaId: string;

  @ValidateNested()
  @Type(() => ChamaMemberDto)
  @ApiProperty({ type: ChamaMemberDto })
  memberInfo: ChamaMember;
}

export class InviteMembersDto implements InviteMembersRequest {
  @IsRequiredUUID()
  @ApiProperty({ example: '7b158dfd-cb98-40b1-9ed2-a13006a9f670' })
  chamaId: string;

  @IsInvites(1, 100, true)
  @ApiProperty({
    type: [ChamaInviteDto],
  })
  invites: ChamaInvite[];
}
