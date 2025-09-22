import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsDate,
  IsArray,
  IsBoolean,
  Min,
  Max,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  WalletType,
  LockPeriod,
  WalletConfig,
  TargetWalletConfig,
  LockedWalletConfig,
} from '../../common';

// Custom validator to ensure at least one target amount is provided
function IsTargetAmountRequired(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTargetAmountRequired',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(_value: any, args: ValidationArguments) {
          const obj = args.object as CreateTargetWalletDto;
          return !!(obj.targetAmountMsats || obj.targetAmountFiat);
        },
        defaultMessage() {
          return 'Either targetAmountMsats or targetAmountFiat must be provided';
        },
      },
    });
  };
}

export class CreateWalletDto implements WalletConfig {
  @ApiProperty({
    enum: WalletType,
    description: 'Type of wallet to create',
    default: WalletType.STANDARD,
  })
  @IsEnum(WalletType)
  walletType: WalletType;

  @ApiPropertyOptional({
    description: 'Custom name for the wallet',
    example: 'Emergency Fund',
  })
  @IsOptional()
  @IsString()
  walletName?: string;

  @ApiPropertyOptional({
    description: 'Tags for organizing wallets',
    example: ['savings', 'emergency'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Spending category',
    example: 'Emergency',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'User notes about the wallet',
    example: 'For unexpected expenses',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTargetWalletDto
  extends CreateWalletDto
  implements TargetWalletConfig
{
  @ApiProperty({
    enum: WalletType,
    description: 'Must be TARGET for target wallets',
    example: WalletType.TARGET,
  })
  @IsEnum(WalletType)
  walletType: WalletType.TARGET;

  @ApiPropertyOptional({
    description: 'Target amount to save (in msats)',
    example: 1000000000, // 1M sats = 1000000000 msats
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @IsTargetAmountRequired()
  targetAmountMsats?: number;

  @ApiPropertyOptional({
    description: 'Target amount to save (in fiat currency)',
    example: 100.5,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetAmountFiat?: number;

  @ApiPropertyOptional({
    description: 'Target date to reach the goal',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  targetDate?: Date;
}

export class CreateLockedWalletDto
  extends CreateWalletDto
  implements LockedWalletConfig
{
  @ApiProperty({
    enum: WalletType,
    description: 'Must be LOCKED for locked wallets',
    example: WalletType.LOCKED,
  })
  @IsEnum(WalletType)
  walletType: WalletType.LOCKED;

  @ApiProperty({
    enum: LockPeriod,
    description: 'Lock period for the savings',
    example: LockPeriod.SIX_MONTHS,
  })
  @IsEnum(LockPeriod)
  lockPeriod: LockPeriod;

  @ApiPropertyOptional({
    description: 'Specific lock end date (for CUSTOM lock period)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lockEndDate?: Date;

  @ApiPropertyOptional({
    description: 'Whether to auto-renew the lock period',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional({
    description: 'Early withdrawal penalty rate (percentage)',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  penaltyRate?: number;
}
