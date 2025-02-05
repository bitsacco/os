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
import {
  ChamaMemberRole,
  type AddMembersRequest,
  type ChamaMember,
  type ChamaUpdates,
  type CreateChamaRequest,
  type FilterChamasRequest,
  type FindChamaRequest,
  type JoinChamaRequest,
  type UpdateChamaRequest,
} from '../types';

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

class ChamaMemberDto implements ChamaMember {
  @IsRequiredUUID()
  userId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ChamaMemberRole, { each: true })
  @Transform(({ value }) => [...new Set(value)])
  roles: ChamaMemberRole[];
}

export class CreateChamaDto implements CreateChamaRequest {
  @IsChamaName()
  name: string;

  @IsMembers(1, 100)
  members: ChamaMember[];

  @IsRequiredUUID()
  createdBy: string;
}

export class ChamaUpdatesDto implements ChamaUpdates {
  @IsChamaName(true)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsMembers(1, 100, true)
  members: ChamaMember[];
}

export class UpdateChamaDto implements UpdateChamaRequest {
  @IsRequiredUUID()
  chamaId: string;

  @ValidateNested()
  @Type(() => ChamaUpdatesDto)
  @IsNotEmpty()
  updates: ChamaUpdates;
}

export class FindChamaDto implements FindChamaRequest {
  @IsRequiredUUID()
  chamaId: string;
}

export class FilterChamasDto implements FilterChamasRequest {
  @IsOptionalUUID()
  createdBy?: string;

  @IsOptionalUUID()
  withMemberId?: string;
}

export class JoinChamaDto implements JoinChamaRequest {
  @IsRequiredUUID()
  chamaId: string;

  @ValidateNested()
  @Type(() => ChamaMemberDto)
  memberInfo: ChamaMember;
}

export class AddMembersDto implements AddMembersRequest {
  @IsRequiredUUID()
  chamaId: string;

  @IsMembers(1, 50)
  newMemberInfo: ChamaMember[];
}
