import { SupportedCurrencies, Currency } from '../types';
import { mapToCurrency } from './currency';

describe('mapToCurrency', () => {
  it('should map KES to Currency.KES', () => {
    const result = mapToCurrency(SupportedCurrencies.KES);
    expect(result).toBe(Currency.KES);
  });

  it('should map BTC to Currency.BTC', () => {
    const result = mapToCurrency(SupportedCurrencies.BTC);
    expect(result).toBe(Currency.BTC);
  });

  it('should throw an error for unsupported currencies', () => {
    expect(() => {
      // @ts-ignore - Intentionally passing an invalid value
      mapToCurrency('UNSUPPORTED');
    }).toThrow('Unsupported currency: UNSUPPORTED');
  });
});
