import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Custom validator to ensure either amountFiat or amountMsats is provided, but not both.
 * This enforces mutual exclusivity between the two amount types while requiring at least one.
 *
 * Usage:
 * @IsOptional()
 * @IsNumber()
 * @IsEitherAmountFiatOrMsats()
 * amountFiat?: number;
 *
 * @IsOptional()
 * @IsNumber()
 * amountMsats?: number;
 */
export function IsEitherAmountFiatOrMsats(
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'isEitherAmountFiatOrMsats',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const hasAmountFiat =
            obj.amountFiat !== undefined && obj.amountFiat !== null;
          const hasAmountMsats =
            obj.amountMsats !== undefined && obj.amountMsats !== null;

          // Exactly one should be provided (XOR logic)
          return hasAmountFiat !== hasAmountMsats;
        },
        defaultMessage() {
          return 'Either amountFiat or amountMsats must be provided, but not both';
        },
      },
    });
  };
}
