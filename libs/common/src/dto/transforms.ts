import { Transform } from 'class-transformer';
import { SupportedCurrencyType } from '../types';
import { mapToCurrency } from '../utils';

export function TransformToCurrency() {
  return Transform(({ value }) =>
    mapToCurrency(value as SupportedCurrencyType),
  );
}
