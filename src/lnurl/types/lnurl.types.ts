import { Currency, TransactionStatus } from '../../common/types';

// LNURL Types
export enum LnurlType {
  PAY_IN = 'PAY_IN', // Receiving via Lightning Address
  PAY_OUT = 'PAY_OUT', // Paying to external LNURL
  WITHDRAW = 'WITHDRAW', // LNURL withdrawal
}

export enum LnurlSubType {
  LIGHTNING_ADDRESS = 'LIGHTNING_ADDRESS',
  EXTERNAL_PAY = 'EXTERNAL_PAY',
  QR_WITHDRAW = 'QR_WITHDRAW',
  LINK_WITHDRAW = 'LINK_WITHDRAW',
}

export enum AddressType {
  PERSONAL = 'PERSONAL',
  CHAMA = 'CHAMA',
  MEMBER_CHAMA = 'MEMBER_CHAMA',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

// Lightning Address interfaces
export interface LightningAddressMetadata {
  description?: string;
  imageUrl?: string;
  identifier?: string; // Full address: username@bitsacco.com
  email?: string; // Contact email
  minSendable: number; // Min amount in millisatoshis
  maxSendable: number; // Max amount in millisatoshis
  commentAllowed?: number; // Max comment length
}

export interface LightningAddressSettings {
  enabled: boolean;
  allowComments: boolean;
  notifyOnPayment: boolean;
  customSuccessMessage?: string;
}

export interface LightningAddressStats {
  totalReceived: number; // Total amount received
  paymentCount: number; // Number of payments
  lastPaymentAt?: Date;
}

export interface LightningAddressDocument {
  _id: string;
  address: string; // e.g., "username" or "chamaname"
  domain: string; // e.g., "bitsacco.com"
  type: AddressType;
  ownerId: string; // userId or chamaId
  memberId?: string; // For MEMBER_CHAMA type
  metadata: LightningAddressMetadata;
  settings: LightningAddressSettings;
  stats: LightningAddressStats;
  createdAt: Date;
  updatedAt: Date;
}

// LNURL Transaction interfaces
export interface LnurlWithdrawData {
  k1: string; // Unique withdrawal identifier
  callback: string;
  minWithdrawable: number;
  maxWithdrawable: number;
  defaultDescription: string;
  expiresAt: Date;
  claimedAt?: Date;
  claimingWallet?: string; // Info about wallet that claimed
}

export interface LnurlLightningAddressData {
  address: string; // e.g., "alice@bitsacco.com"
  addressId: string; // Reference to LightningAddress record
  payer?: string; // External payer info if provided
  comment?: string;
}

export interface LnurlExternalPayData {
  targetAddress?: string; // e.g., "bob@wallet.com"
  targetUrl?: string; // Direct LNURL
  targetDomain: string;
  metadata: any; // LUD-06 metadata
  comment?: string;
  successAction?: any;
}

export interface LnurlData {
  lightningAddress?: LnurlLightningAddressData;
  withdraw?: LnurlWithdrawData;
  externalPay?: LnurlExternalPayData;
}

export interface LnurlLightning {
  invoice?: string;
  preimage?: string;
  paymentHash?: string;
  operationId?: string; // Fedimint operation ID
}

export interface LnurlTransactionDocument {
  _id: string;
  type: LnurlType;
  subType?: LnurlSubType;
  status: TransactionStatus;
  userId: string;
  chamaId?: string; // For chama-related transactions

  // Amount details
  amountMsats: number;
  amountFiat: number;
  currency: Currency;

  // LNURL-specific data
  lnurlData: LnurlData;

  // Lightning details
  lightning: LnurlLightning;

  // Metadata
  reference: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// External LNURL Target interfaces
export interface ExternalTargetMetadata {
  callback: string;
  minSendable: number;
  maxSendable: number;
  commentAllowed?: number;
  tag: string;
  metadata: string; // LUD-06 metadata
  cachedAt: Date;
  ttl: number; // Cache TTL in seconds
}

export interface ExternalTargetInfo {
  address?: string; // Lightning Address
  lnurl?: string; // Raw LNURL
  domain: string;
  metadata?: ExternalTargetMetadata;
}

export interface ExternalTargetStats {
  lastUsedAt?: Date;
  totalSent: number;
  paymentCount: number;
}

export interface ExternalTargetPreferences {
  nickname?: string; // User's nickname for this target
  isFavorite: boolean;
  defaultComment?: string;
}

export interface ExternalLnurlTargetDocument {
  _id: string;
  userId: string;
  type: 'LNURL_PAY' | 'LIGHTNING_ADDRESS';
  target: ExternalTargetInfo;
  stats: ExternalTargetStats;
  preferences: ExternalTargetPreferences;
  createdAt: Date;
  updatedAt: Date;
}

// LNURL-pay response types (LUD-06)
export interface LnurlPayResponse {
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: string;
  tag: 'payRequest';
  commentAllowed?: number;
  allowsNostr?: boolean;
  nostrPubkey?: string;
}

export interface LnurlPayInvoiceResponse {
  pr: string; // Bolt11 invoice
  routes?: any[];
  successAction?: {
    tag: string;
    message?: string;
    url?: string;
    description?: string;
  };
}

// LNURL-withdraw response types (LUD-03)
export interface LnurlWithdrawResponse {
  callback: string;
  k1: string;
  minWithdrawable: number;
  maxWithdrawable: number;
  defaultDescription: string;
  tag: 'withdrawRequest';
}

export interface LnurlWithdrawCallbackResponse {
  status: 'OK' | 'ERROR';
  reason?: string;
}

// Resolver types
export interface ResolvedAddress {
  type: 'internal' | 'external';
  addressType?: AddressType;
  ownerId?: string;
  memberId?: string;
  addressId?: string;
  metadata?: {
    identifier?: string;
    description?: string;
    imageUrl?: string;
    minSendable: number;
    maxSendable: number;
    commentAllowed?: number;
  };
  settings?: LightningAddressSettings;
}

export interface ParsedAddress {
  localPart: string; // Part before @
  domain: string; // Part after @
  username?: string; // For member-chama format
  chamaname?: string; // For member-chama format
}

// Payment types
export interface PaymentOptions {
  comment?: string;
  amount?: number;
  nostr?: any;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  preimage?: string;
  successAction?: any;
  error?: string;
}

// Withdrawal types
export interface WithdrawOptions {
  amountMsats: number;
  description?: string;
  expiryMinutes?: number;
  singleUse?: boolean;
  minWithdrawable?: number;
  maxWithdrawable?: number;
}

export interface WithdrawLink {
  withdrawId: string;
  lnurl: string;
  qrCode?: string;
  k1: string;
  expiresAt: Date;
  minWithdrawable: number;
  maxWithdrawable: number;
}

// Utility types
export interface QrCodeOptions {
  size?: number;
  margin?: number;
  format?: 'png' | 'svg' | 'base64';
  logo?: string;
  color?: {
    dark?: string;
    light?: string;
  };
}

// Type guards
export function isLightningAddress(input: string): boolean {
  const pattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(input);
}

export function isLnurl(input: string): boolean {
  return input.toLowerCase().startsWith('lnurl');
}

export function isBech32(input: string): boolean {
  try {
    // Basic bech32 validation
    const pattern = /^lnurl[0-9a-z]+$/i;
    return pattern.test(input) && input.length > 10;
  } catch {
    return false;
  }
}
