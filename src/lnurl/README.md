# LNURL Module

## Overview

The LNURL module provides a unified service for handling Lightning URL protocols in the Bitsacco ecosystem. It implements the LNURL specifications for seamless Lightning Network interactions through QR codes and human-readable addresses.

### Supported Features

- **LNURL-withdraw**: QR code/link-based withdrawals from user wallets
- **Lightning Address**: Human-readable payment addresses (e.g., user@bitsacco.com)
- **External LNURL payments**: Send payments to external Lightning addresses and LNURL-pay endpoints
- **LNURL-pay**: Receive payments via LNURL protocol

## Service Architecture

### Core Services

#### 1. LnurlWithdrawService
Handles withdrawal link creation and Lightning invoice generation.

**Key responsibilities:**
- Create single-use or reusable withdrawal links
- Generate QR codes for easy scanning
- Validate withdrawal requests and amounts
- Integrate with Fedimint for Lightning operations
- Track withdrawal transactions

**Key methods:**
```typescript
createWithdrawLink(userId: string, options: WithdrawOptions): Promise<WithdrawLink>
handleWithdrawRequest(k1: string): Promise<LnurlWithdrawResponse>
completeWithdrawal(k1: string, invoice: string): Promise<{ status: string }>
```

#### 2. LightningAddressService
Manages Lightning addresses for receiving payments.

**Key responsibilities:**
- Create and manage user Lightning addresses
- Resolve addresses to LNURL-pay metadata
- Handle payment callbacks and invoice generation
- Support both personal and chama (group) addresses
- Member-attributed deposits for chama addresses

**Key methods:**
```typescript
createAddress(userId: string, params: CreateAddressParams): Promise<LightningAddress>
resolveAddress(address: string): Promise<LnurlPayResponse>
handlePaymentCallback(addressId: string, params: CallbackParams): Promise<InvoiceResponse>
```

#### 3. LnurlPaymentService
Handles external LNURL payments and target management.

**Key responsibilities:**
- Send payments to external Lightning addresses
- Manage saved payment targets
- Enforce payment limits (daily, monthly, per-target)
- Track payment history
- Cache external LNURL metadata

**Key methods:**
```typescript
payExternal(userId: string, target: string, options: ExternalPaymentOptions): Promise<ExternalPaymentResult>
saveExternalTarget(userId: string, target: string, resolved: any, nickname?: string): Promise<ExternalLnurlTarget>
getSavedTargets(userId: string, options?: ListOptions): Promise<{ targets: ExternalLnurlTarget[], total: number }>
```

#### 4. LnurlResolverService
Resolves and validates external LNURL endpoints.

**Key responsibilities:**
- Resolve Lightning addresses to LNURL endpoints
- Decode LNURL strings
- Fetch and cache external metadata
- Validate domains and SSL certificates
- Handle different LNURL types (pay, withdraw, channel, auth)

**Key methods:**
```typescript
resolve(input: string): Promise<ResolvedLnurl>
resolveLightningAddress(address: string): Promise<LnurlPayMetadata>
fetchExternalMetadata(url: string, options?: FetchOptions): Promise<any>
```

#### 5. LnurlCommonService
Provides shared utilities for LNURL operations.

**Key responsibilities:**
- LNURL encoding/decoding
- QR code generation
- Amount validation and conversion
- Domain validation
- Common helper functions

**Key methods:**
```typescript
encodeLnurl(url: string): string
decodeLnurl(lnurl: string): string
generateQrCode(data: string, options?: QrOptions): Promise<string>
validateAmount(amount: number, min: number, max: number): boolean
msatsToFiat(msats: number, rate: number): number
```

### Supporting Services

#### AddressResolverService
Handles Lightning address resolution and validation.

**Key responsibilities:**
- Parse Lightning address formats
- Validate address availability
- Resolve addresses to user/chama entities

#### LnurlMetricsService
Provides comprehensive metrics tracking.

**Key responsibilities:**
- Track withdrawal metrics (created, completed, expired)
- Monitor Lightning address activity
- Track external payment success/failure rates
- Monitor API performance
- Export Prometheus metrics

## Database Schemas

### LnurlTransaction
Unified transaction tracking for all LNURL operations.

```typescript
{
  type: 'WITHDRAW' | 'PAY_IN' | 'PAY_OUT',
  subType: 'LNURL_WITHDRAW' | 'LIGHTNING_ADDRESS' | 'EXTERNAL_PAY',
  status: 'PENDING' | 'COMPLETE' | 'FAILED' | 'EXPIRED',
  userId: string,
  chamaId?: string,
  amountMsats: number,
  amountFiat: number,
  currency: string,
  lightning: {
    k1?: string,
    invoice?: string,
    preimage?: string,
    operationId?: string,
  },
  lnurlData: {
    // Type-specific data
  },
  metadata: object,
  createdAt: Date,
  completedAt?: Date,
  expiresAt?: Date,
}
```

### LightningAddress
Manages Lightning addresses for users and chamas.

```typescript
{
  address: string,
  type: 'PERSONAL' | 'CHAMA',
  userId?: string,
  chamaId?: string,
  isActive: boolean,
  settings: {
    minReceivable: number,
    maxReceivable: number,
    description?: string,
    allowComments: boolean,
    metadata: object,
  },
  stats: {
    totalReceived: number,
    paymentCount: number,
    lastPaymentAt?: Date,
  },
  createdAt: Date,
  updatedAt: Date,
  deactivatedAt?: Date,
}
```

### ExternalLnurlTarget
Stores saved external payment targets.

```typescript
{
  userId: string,
  type: 'LIGHTNING_ADDRESS' | 'LNURL_PAY',
  target: {
    address?: string,
    lnurl?: string,
    domain: string,
    metadata?: object,
  },
  stats: {
    totalSent: number,
    paymentCount: number,
    lastUsedAt?: Date,
  },
  preferences: {
    nickname?: string,
    isFavorite: boolean,
    defaultAmount?: number,
  },
  createdAt: Date,
  updatedAt: Date,
}
```

## API Endpoints

### LNURL Withdrawal
- `GET /v1/lnurl/withdraw/callback` - LNURL-withdraw protocol endpoint (public)
- `POST /v1/lnurl/withdraw` - Create withdrawal link
- `GET /v1/lnurl/withdraw/list` - List user's withdrawals
- `GET /v1/lnurl/withdraw/:id` - Get withdrawal status
- `DELETE /v1/lnurl/withdraw/:id` - Cancel withdrawal

### Lightning Address
- `GET /.well-known/lnurlp/:address` - LNURL-pay metadata endpoint (public)
- `GET /v1/lnurl/callback/:addressId` - Payment callback endpoint (public)
- `POST /v1/lnurl/lightning-address` - Create Lightning address
- `GET /v1/lnurl/lightning-address/:addressId` - Get address details
- `PATCH /v1/lnurl/lightning-address/:addressId` - Update address settings
- `DELETE /v1/lnurl/lightning-address/:addressId` - Deactivate address
- `GET /v1/lnurl/lightning-address/my-addresses` - List user's addresses
- `GET /v1/lnurl/lightning-address/:addressId/payments` - Get payment history

### External Payments
- `POST /v1/lnurl/payment/external` - Send external payment
- `GET /v1/lnurl/payment/targets` - List saved targets
- `GET /v1/lnurl/payment/targets/:targetId` - Get target details
- `PATCH /v1/lnurl/payment/targets/:targetId` - Update target preferences
- `DELETE /v1/lnurl/payment/targets/:targetId` - Delete saved target
- `GET /v1/lnurl/payment/history` - Get payment history

## Configuration

### Required Environment Variables

```env
# Domain configuration
LNURL_DOMAIN=bitsacco.com
LNURL_CALLBACK_BASE_URL=https://api.bitsacco.com

# Optional configurations
LNURL_WITHDRAWAL_EXPIRY_MINUTES=60
LNURL_MAX_WITHDRAWABLE_SATS=1_000_000
LNURL_MIN_WITHDRAWABLE_SATS=1
LNURL_EXTERNAL_PAYMENT_TIMEOUT_MS=30000
LNURL_METADATA_CACHE_TTL_SECONDS=300
```

### Payment Limits Configuration

Default limits (can be customized per user):
- Daily limit: 100,000 sats
- Monthly limit: 1,000,000 sats
- Per-target limit: 50,000 sats

## Implementation Guidelines

### Error Handling

All services follow a consistent error handling pattern:

```typescript
try {
  // Operation logic
} catch (error) {
  if (error instanceof HttpException) {
    throw error; // Re-throw NestJS exceptions
  }
  
  this.logger.error(`Operation failed: ${error.message}`);
  
  // Record metrics
  this.metricsService.recordError('operation_type', 'endpoint', error.code);
  
  // Throw appropriate exception
  throw new BadRequestException('User-friendly error message');
}
```

### Transaction Lifecycle

1. **Creation**: Transaction created with PENDING status
2. **Processing**: Lightning operations performed
3. **Completion**: 
   - Success: Status updated to COMPLETE with preimage
   - Failure: Status updated to FAILED with error details
   - Timeout: Status updated to EXPIRED

### Security Considerations

1. **K1 Token Generation**: Use cryptographically secure random generation
2. **Domain Validation**: Always validate external domains before LNURL resolution
3. **SSL Verification**: Verify SSL certificates for external endpoints
4. **Rate Limiting**: Implement rate limits on all public endpoints
5. **Amount Validation**: Always validate amounts against min/max limits
6. **User Authorization**: Verify user ownership before operations

### Caching Strategy

1. **External Metadata**: Cache for 5 minutes (configurable)
2. **Lightning Address Resolution**: Cache for 1 hour
3. **QR Codes**: Generate on-demand, don't cache
4. **Domain Validation**: Cache for 24 hours

### Testing Approach

1. **Unit Tests**: Test individual service methods
2. **Integration Tests**: Test controller endpoints
3. **Protocol Tests**: Verify LNURL protocol compliance
4. **External Tests**: Mock external LNURL endpoints

## Common Integration Patterns

### Creating a Withdrawal Link

```typescript
const withdrawal = await lnurlWithdrawService.createWithdrawLink(userId, {
  amountMsats: 100000,
  description: 'Withdrawal from savings',
  expiryMinutes: 60,
  singleUse: true,
  minWithdrawable: 1000,
  maxWithdrawable: 100000
});

// Display QR code to user
return {
  qrCode: withdrawal.qrCode,
  lnurl: withdrawal.lnurl,
  expiresAt: withdrawal.expiresAt
};
```

### Receiving via Lightning Address

```typescript
// User creates address
const address = await lightningAddressService.createAddress(userId, {
  address: 'alice',
  type: 'PERSONAL',
  settings: {
    minReceivable: 1_000,
    maxReceivable: 1_000_000,
    description: 'Tips for Alice'
  }
});

// External wallet resolves alice@bitsacco.com
// → GET /.well-known/lnurlp/alice
// → Returns LNURL-pay metadata
// → Wallet requests invoice with amount
// → Payment tracked in LnurlTransaction
```

### Sending External Payment

```typescript
// Pay to external Lightning address
const payment = await lnurlPaymentService.payExternal(
  userId,
  'bob@wallet.com',
  {
    amountMsats: 50000,
    comment: 'Thanks for coffee!',
    saveTarget: true,
    targetNickname: 'Bob Coffee Shop'
  }
);

// Check payment status
if (payment.success) {
  console.log(`Payment sent! ID: ${payment.paymentId}`);
}
```

## Troubleshooting

### Common Issues

1. **"Domain not accessible"**: External domain SSL verification failed
2. **"Invalid Lightning address"**: Address format incorrect or doesn't exist
3. **"Payment limit exceeded"**: User hit daily/monthly limits
4. **"Withdrawal expired"**: Link used after expiry time
5. **"Invalid amount"**: Amount outside min/max bounds

### Debug Logging

Enable debug logs for troubleshooting:

```typescript
// In service constructor
private readonly logger = new Logger(ServiceName.name);

// Use throughout service
this.logger.debug(`Detailed operation info`);
this.logger.error(`Error details: ${error.stack}`);
```

## Future Enhancements

1. **LNURL-auth**: Implement authentication via Lightning
2. **LNURL-channel**: Support channel opening requests
3. **Nostr Integration**: Add Nostr zap support
4. **WebLN Support**: Browser-based Lightning payments
5. **NFC Tags**: Support for physical LNURL tags
6. **Recurring Payments**: Subscription support
7. **Payment Proofs**: Cryptographic payment verification

## Contributing

When contributing to the LNURL module:

1. Follow existing code patterns and conventions
2. Add comprehensive tests for new features
3. Update this documentation
4. Record metrics for new operations
5. Consider backward compatibility
6. Add proper error handling and logging
7. Validate all external inputs
8. Follow LNURL protocol specifications

## References

- [LNURL Specifications](https://github.com/lnurl/luds)
- [Lightning Address](https://lightningaddress.com/)
- [LNURL-pay Flow](https://github.com/lnurl/luds/blob/luds/06.md)
- [LNURL-withdraw Flow](https://github.com/lnurl/luds/blob/luds/03.md)
