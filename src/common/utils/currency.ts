import { SupportedCurrencyType, Currency } from '../types';

const BTC_IN_SATS = 100_000_000;
const SATS_IN_MILLI_SATS = 1_000;
const BTC_IN_MILLI_SATS = 100_000_000_000;

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

export function mapToSupportedCurrency(
  currency: Currency,
): SupportedCurrencyType {
  switch (currency) {
    case Currency.BTC:
      return 'BTC' as SupportedCurrencyType;
    case Currency.KES:
      return 'KES' as SupportedCurrencyType;
    default:
      throw new Error(`Unsupported currency: ${currency}`);
  }
}

export function fiatToBtc({
  amountFiat,
  btcToFiatRate,
}: {
  amountFiat: number;
  btcToFiatRate: number;
}): {
  amountBtc: number;
  amountSats: number;
  amountMsats: number;
} {
  const amountBtc = amountFiat / btcToFiatRate;
  const amountSats = Math.floor(amountBtc * BTC_IN_SATS);
  const amountMsats = Math.floor(amountSats * SATS_IN_MILLI_SATS);

  return { amountBtc, amountSats, amountMsats };
}

export function btcToFiat({
  amountBtc,
  amountSats,
  amountMsats,
  fiatToBtcRate,
}: {
  amountBtc?: number;
  amountSats?: number;
  amountMsats?: number;
  fiatToBtcRate: number;
}): {
  amountFiat: number;
} {
  let btcAmount: number;

  if (amountBtc !== undefined) {
    btcAmount = amountBtc;
  } else if (amountSats !== undefined) {
    btcAmount = amountSats / BTC_IN_SATS;
  } else if (amountMsats !== undefined) {
    btcAmount = amountMsats / BTC_IN_MILLI_SATS;
  } else {
    throw new Error(
      'One of amountBtc, amountSats, or amountMsats must be provided',
    );
  }

  const amountFiat = btcAmount * fiatToBtcRate;

  return { amountFiat };
}
