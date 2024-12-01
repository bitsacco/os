// Scenarios in which onramp swap can receive payment
export enum ReceiveContext {
  FUNDING,
  OFFRAMP,
  SOLOWALLET,
}

export interface ReceivePaymentSuccessEvent {
  operationId: string;
  context: ReceiveContext;
}

export interface ReceivePaymentFailureEvent extends ReceivePaymentSuccessEvent {
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
