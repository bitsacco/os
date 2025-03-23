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
