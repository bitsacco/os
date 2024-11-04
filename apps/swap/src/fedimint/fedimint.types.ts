export const fedimint_receive_success = 'fedimint.receive.success';
export const fedimint_receive_failure = 'fedimint.receive.failure';

// Scenarios in which onramp swap can receive payment
export enum ReceiveContext {
  FUNDING,
  OFFRAMP,
}

interface ReceivePaymentEvent {
  operationId: string;
  context: ReceiveContext;
}

export interface ReceivePaymentSuccessEvent extends ReceivePaymentEvent {}

export interface ReceivePaymentFailureEvent extends ReceivePaymentEvent {
  error: string;
}

export interface LightningInvoiceResponse {
  operationId: string;
  invoice: string;
}

export interface LightningPayResponse {
  operationId: string;
  paymentType: string;
  contractId: string;
  fee: number;
}

export interface WithFederationId {
  federationId: string;
}

export interface WithGatewayId {
  gatewayId: string;
}
