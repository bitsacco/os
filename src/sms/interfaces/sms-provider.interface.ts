export interface SendSmsResult {
  messageId: string;
  status: string;
}

export interface SendBulkSmsResult {
  successful: number;
  failed: number;
  results: Array<{
    receiver: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export interface ISmsProvider {
  /**
   * Send a single SMS message
   */
  sendSms(message: string, receiver: string): Promise<SendSmsResult>;

  /**
   * Send bulk SMS messages to multiple receivers
   */
  sendBulkSms(message: string, receivers: string[]): Promise<SendBulkSmsResult>;

  /**
   * Get provider name
   */
  getProviderName(): string;
}
