import { SupportedCurrencyType, Currency } from '../types';

export function mapToCurrency(currency: SupportedCurrencyType): Currency {
  switch (currency) {
    case 'KES':
      return Currency.KES;
    case 'BTC':
      return Currency.BTC;
    default:
      throw new Error(`Unsupported currency: ${currency}`);
  }
}

export function satsFromKes({
  amountKes,
  btcToKesRate,
}: {
  amountKes: number;
  btcToKesRate: number;
}): string {
  return ((amountKes * 100000000) / btcToKesRate).toFixed(2);
}

export function btcFromKes({
  amountKes,
  btcToKesRate,
}: {
  amountKes: number;
  btcToKesRate: number;
}): string {
  return (amountKes / btcToKesRate).toFixed(9);
}

export function kesFromBtc({
  amountBtc,
  kesToBtcRate,
}: {
  amountBtc: number;
  kesToBtcRate: number;
}): string {
  return (amountBtc * kesToBtcRate).toFixed(9);
}
