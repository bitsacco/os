// Domain Events Catalog

// User Domain Events
export const USER_EVENTS = {
  REGISTERED: 'user.registered',
  LOGIN_ATTEMPTED: 'user.login.attempted',
  LOGIN_SUCCESSFUL: 'user.login.successful',
  LOGIN_FAILED: 'user.login.failed',
  PROFILE_UPDATED: 'user.profile.updated',
  PASSWORD_CHANGED: 'user.password.changed',
  ACCOUNT_SUSPENDED: 'user.account.suspended',
  ACCOUNT_ACTIVATED: 'user.account.activated',
} as const;

// Authentication Domain Events
export const AUTH_EVENTS = {
  TOKEN_GENERATED: 'auth.token.generated',
  TOKEN_REFRESHED: 'auth.token.refreshed',
  TOKEN_REVOKED: 'auth.token.revoked',
  API_KEY_CREATED: 'auth.apikey.created',
  API_KEY_ROTATED: 'auth.apikey.rotated',
  API_KEY_REVOKED: 'auth.apikey.revoked',
  OTP_GENERATED: 'auth.otp.generated',
  OTP_VERIFIED: 'auth.otp.verified',
} as const;

// Chama Domain Events
export const CHAMA_EVENTS = {
  CREATED: 'chama.created',
  UPDATED: 'chama.updated',
  MEMBER_INVITED: 'chama.member.invited',
  MEMBER_JOINED: 'chama.member.joined',
  MEMBER_LEFT: 'chama.member.left',
  MEMBER_REMOVED: 'chama.member.removed',
  DEPOSIT_MADE: 'chama.deposit.made',
  WITHDRAWAL_MADE: 'chama.withdrawal.made',
  PAYMENT_PROCESSED: 'chama.payment.processed',
  GOAL_REACHED: 'chama.goal.reached',
  CYCLE_COMPLETED: 'chama.cycle.completed',
} as const;

// Wallet Domain Events
export const WALLET_EVENTS = {
  CREATED: 'wallet.created',
  BALANCE_UPDATED: 'wallet.balance.updated',
  TRANSACTION_SENT: 'wallet.transaction.sent',
  TRANSACTION_RECEIVED: 'wallet.transaction.received',
  LIGHTNING_INVOICE_CREATED: 'wallet.lightning.invoice.created',
  LIGHTNING_PAYMENT_SENT: 'wallet.lightning.payment.sent',
  FEDIMINT_DEPOSIT: 'wallet.fedimint.deposit',
  FEDIMINT_WITHDRAWAL: 'wallet.fedimint.withdrawal',
} as const;

// Shares Domain Events
export const SHARES_EVENTS = {
  OFFER_CREATED: 'shares.offer.created',
  OFFER_UPDATED: 'shares.offer.updated',
  OFFER_CANCELLED: 'shares.offer.cancelled',
  SHARES_PURCHASED: 'shares.purchased',
  SHARES_SOLD: 'shares.sold',
  DIVIDEND_PAID: 'shares.dividend.paid',
  PORTFOLIO_UPDATED: 'shares.portfolio.updated',
} as const;

// Notification Domain Events
export const NOTIFICATION_EVENTS = {
  CREATED: 'notification.created',
  SENT: 'notification.sent',
  DELIVERED: 'notification.delivered',
  FAILED: 'notification.failed',
  READ: 'notification.read',
  PREFERENCES_UPDATED: 'notification.preferences.updated',
} as const;

// Communication Domain Events
export const COMMUNICATION_EVENTS = {
  SMS_SENT: 'communication.sms.sent',
  SMS_DELIVERED: 'communication.sms.delivered',
  SMS_FAILED: 'communication.sms.failed',
  NOSTR_EVENT_PUBLISHED: 'communication.nostr.event.published',
  NOSTR_EVENT_FAILED: 'communication.nostr.event.failed',
  EMAIL_SENT: 'communication.email.sent',
} as const;

// System Events
export const SYSTEM_EVENTS = {
  SERVICE_STARTED: 'system.service.started',
  SERVICE_STOPPED: 'system.service.stopped',
  HEALTH_CHECK_FAILED: 'system.health.check.failed',
  DATABASE_CONNECTION_LOST: 'system.database.connection.lost',
  EXTERNAL_SERVICE_UNAVAILABLE: 'system.external.service.unavailable',
  RATE_LIMIT_EXCEEDED: 'system.rate.limit.exceeded',
} as const;

// Export all events
export const DOMAIN_EVENTS = {
  USER: USER_EVENTS,
  AUTH: AUTH_EVENTS,
  CHAMA: CHAMA_EVENTS,
  WALLET: WALLET_EVENTS,
  SHARES: SHARES_EVENTS,
  NOTIFICATION: NOTIFICATION_EVENTS,
  COMMUNICATION: COMMUNICATION_EVENTS,
  SYSTEM: SYSTEM_EVENTS,
} as const;

// Event payload types
export interface UserRegisteredEvent {
  userId: string;
  phone: string;
  registrationMethod: 'phone' | 'nostr';
  timestamp: Date;
}

export interface ChamaCreatedEvent {
  chamaId: string;
  ownerId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currency: string;
  memberLimit: number;
  timestamp: Date;
}

export interface WalletTransactionEvent {
  walletId: string;
  userId: string;
  transactionId: string;
  type: 'send' | 'receive';
  amount: number;
  currency: string;
  fee?: number;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
}

export interface NotificationSentEvent {
  notificationId: string;
  userId: string;
  type: 'sms' | 'nostr' | 'email' | 'websocket';
  category: string;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
}
