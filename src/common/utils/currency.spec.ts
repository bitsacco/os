import { SupportedCurrencies, Currency } from '../types';
import { mapToCurrency, mapToSupportedCurrency } from './currency';

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

describe('mapToSupportedCurrency', () => {
  it('should map Currency.KES to SupportedCurrencies.KES', () => {
    const result = mapToSupportedCurrency(Currency.KES);
    expect(result).toBe(SupportedCurrencies.KES);
  });

  it('should map Currency.BTC to SupportedCurrencies.BTC', () => {
    const result = mapToSupportedCurrency(Currency.BTC);
    expect(result).toBe(SupportedCurrencies.BTC);
  });

  it('should throw an error for unsupported currencies', () => {
    expect(() => {
      // @ts-ignore - Intentionally passing an invalid value
      mapToSupportedCurrency('UNSUPPORTED');
    }).toThrow('Unsupported currency: UNSUPPORTED');
  });
});
