import { TransactionStatus } from '../types';

// Scenarios in which onramp swap can receive payment
export enum FedimintContext {
  OFFRAMP_RECEIVE,
  SOLOWALLET_RECEIVE,
  CHAMAWALLET_RECEIVE,
}

export interface FedimintReceiveSuccessEvent {
  operationId: string;
  context: FedimintContext;
}

export interface FedimintReceiveFailureEvent {
  operationId: string;
  context: FedimintContext;
  error?: string;
}

export enum SwapContext {
  ONRAMP,
  OFFRAMP,
}

export interface SwapStatusChangePayload {
  swapTracker: string;
  swapStatus: TransactionStatus;
  refundable?: boolean;
}

export interface SwapStatusChangeEvent {
  context: SwapContext;
  payload: SwapStatusChangePayload;
  error?: string;
}
