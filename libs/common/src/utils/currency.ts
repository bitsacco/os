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
  const amountSats = amountBtc * 100000000;
  const amountMsats = amountSats * 1000;

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
    btcAmount = amountSats / 100000000;
  } else if (amountMsats !== undefined) {
    btcAmount = amountMsats / 100000000000;
  } else {
    throw new Error(
      'One of amountBtc, amountSats, or amountMsats must be provided',
    );
  }

  const amountFiat = btcAmount * fiatToBtcRate;

  return { amountFiat };
}
