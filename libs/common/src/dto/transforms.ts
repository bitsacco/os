import { Transform } from 'class-transformer';
import { SupportedCurrencyType } from '../types';
import { mapToCurrency } from '../utils';

export function TransformToCurrency() {
  return Transform(({ value }) => {
    if (typeof value === 'number') {
      return value;
    }

    return mapToCurrency(value as SupportedCurrencyType);
  });
}
