import { Currency } from './proto/swap';

export type SupportedCurrencyType = Extract<Currency, 'KES' | 'BTC'>;

export const SupportedCurrencies = {
  KES: 'KES' as SupportedCurrencyType,
  BTC: 'BTC' as SupportedCurrencyType,
} as const;

export type SupportedCurrencyKeys = keyof typeof SupportedCurrencies;

export interface OnrampQuoteRequest {
  from: SupportedCurrencyType;
  to: SupportedCurrencyType;
  amount?: string;
}

interface MemberStatus {
  hasShares: boolean;
}

interface ServiceStatus {
  isRunning: boolean
}

export interface BitsaccoStatus {
  memberStatus: MemberStatus;
  swapStatus: ServiceStatus;
}
