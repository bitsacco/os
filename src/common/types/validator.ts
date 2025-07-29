import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isStringifiedNumber', async: false })
export class IsStringifiedNumberConstraint
  implements ValidatorConstraintInterface
{
  validate(text: string, args: ValidationArguments) {
    const num = Number(text);
    return !isNaN(num) && num >= 0;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Amount must be a valid non-negative number encoded as a string';
  }
}
