/**
 * Types for seeder data
 */

// User types
export interface User {
  id: string;
  pinHash?: string; // Added for seeding purposes
  phone?: {
    number: string;
    verified: boolean;
  };
  nostr?: {
    npub: string;
    verified: boolean;
  };
  profile?: {
    name?: string;
    avatar_url?: string;
  };
  roles: Role[];
}

export enum Role {
  Member = 0,
  Admin = 1,
  SuperAdmin = 3,
}

// Shares types
export interface SharesOffer {
  id: string;
  quantity: number;
  subscribed_quantity: number;
  available_from: string;
  available_to?: string;
  created_at: string;
  updated_at?: string;
}

export interface SharesTx {
  id: string;
  user_id: string;
  offer_id: string;
  quantity: number;
  status: SharesTxStatus;
  transfer?: SharesTxTransferMeta;
  created_at: string;
  updated_at?: string;
}

export enum SharesTxStatus {
  PROPOSED = 0,
  PROCESSING = 1,
  APPROVED = 2,
  COMPLETE = 3,
  FAILED = 4,
}

export interface SharesTxTransferMeta {
  from_user_id: string;
  to_user_id: string;
  quantity: number;
}

// Chama types
export interface Chama {
  id: string;
  name: string;
  description?: string;
  members: ChamaMember[];
  created_by: string;
}

export interface ChamaMember {
  user_id: string;
  roles: ChamaMemberRole[];
}

export enum ChamaMemberRole {
  Member = 0,
  Admin = 1,
  ExternalAdmin = 3,
}

// Chama wallet types
export interface ChamaWalletTx {
  id: string;
  member_id: string;
  chama_id: string;
  status: ChamaTxStatus;
  amount_msats: number;
  amount_fiat?: number;
  lightning: {
    invoice: string;
  };
  type: TransactionType;
  reviews: ChamaTxReview[];
  reference: string;
  createdAt: string;
  updatedAt?: string;
}

export enum ChamaTxStatus {
  PENDING = 0,
  PROCESSING = 1,
  FAILED = 2,
  COMPLETE = 3,
  APPROVED = 4,
  REJECTED = 5,
}

export interface ChamaTxReview {
  member_id: string;
  review: Review;
}

export enum Review {
  REJECT = 0,
  APPROVE = 1,
}

// Solowallet types
export interface SolowalletTx {
  id: string;
  user_id: string;
  status: TransactionStatus;
  amount_msats: number;
  amount_fiat?: number;
  lightning: {
    invoice: string;
  };
  type: TransactionType;
  reference: string;
  createdAt: string;
  updatedAt?: string;
}

export enum TransactionStatus {
  PENDING = 0,
  PROCESSING = 1,
  FAILED = 2,
  COMPLETE = 3,
}

export enum TransactionType {
  DEPOSIT = 0,
  WITHDRAW = 1,
}

// Common types
export enum Currency {
  BTC = 0,
  KES = 1,
}

export interface PaginatedRequest {
  page: number;
  size: number;
}
