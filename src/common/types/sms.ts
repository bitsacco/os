export interface SendSmsRequest {
  message: string;
  receiver: string;
}

export interface SendBulkSmsRequest {
  message: string;
  receivers: string[];
}
