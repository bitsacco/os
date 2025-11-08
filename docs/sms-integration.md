# SMS Integration Architecture

## Overview

The Bitsacco OS SMS Integration provides a flexible, multi-provider architecture for sending transactional and operational SMS messages to users. This document describes the system architecture, design decisions, and application scenarios for SMS communication within the Bitsacco ecosystem.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Why SMS for Bitsacco](#why-sms-for-bitsacco)
3. [Architecture Overview](#architecture-overview)
4. [System Components](#system-components)
5. [Design Patterns](#design-patterns)
6. [Application Scenarios](#application-scenarios)
7. [Provider Integration](#provider-integration)
8. [Message Flow](#message-flow)
9. [Security Considerations](#security-considerations)
10. [Monitoring and Observability](#monitoring-and-observability)
11. [Future Enhancements](#future-enhancements)

---

## Introduction

SMS (Short Message Service) is a critical communication channel in the Bitsacco platform, enabling real-time notifications, authentication, and community engagement. The SMS integration is designed to be:

- **Reliable:** Multi-provider support with failover capabilities
- **Flexible:** Configuration-based provider switching
- **Scalable:** Batch processing and rate limiting
- **Observable:** Comprehensive metrics and logging
- **Secure:** Encrypted credentials and audit trails

---

## Why SMS for Bitsacco

### Context: Financial Inclusion in Africa

Bitsacco operates in regions where:
- **Mobile-first users:** Majority access services via mobile phones
- **Limited internet access:** SMS works on basic feature phones without data
- **Low digital literacy:** SMS is familiar and requires minimal technical knowledge
- **Trust factor:** Users trust SMS for financial notifications more than app notifications

### Critical Use Cases

1. **Authentication:** OTP delivery for secure login and transactions
2. **Transaction Notifications:** Real-time alerts for wallet operations
3. **Community Coordination:** Chama (savings group) invites and updates
4. **Withdrawal Confirmations:** Multi-signature approval notifications
5. **System Alerts:** Critical system events requiring immediate user attention

### Business Impact

- **User Onboarding:** SMS OTP enables secure, friction-free registration
- **Transaction Security:** Two-factor authentication prevents unauthorized access
- **Community Engagement:** 3x higher response rate for SMS vs. email
- **Regulatory Compliance:** Audit trail for financial communications
- **User Trust:** Transparent communication builds platform credibility

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Bitsacco OS                             │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Service │  │ Notification │  │    Chama     │      │
│  │              │  │   Service    │  │   Service    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │   SMS Service  │                        │
│                    │   (Facade)     │                        │
│                    └───────┬────────┘                        │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │ Provider       │                        │
│                    │ Factory        │                        │
│                    └───────┬────────┘                        │
│                            │                                 │
│              ┌─────────────┴─────────────┐                  │
│              │                           │                  │
│      ┌───────▼────────┐         ┌───────▼────────┐         │
│      │ Twilio         │         │ Africa's       │         │
│      │ Provider       │         │ Talking        │         │
│      │                │         │ Provider       │         │
│      └───────┬────────┘         └───────┬────────┘         │
│              │                           │                  │
└──────────────┼───────────────────────────┼──────────────────┘
               │                           │
               │                           │
       ┌───────▼────────┐          ┌──────▼───────┐
       │ Twilio API     │          │ Africa's     │
       │ (Global)       │          │ Talking API  │
       │                │          │ (Africa)     │
       └────────────────┘          └──────────────┘
```

### Architectural Principles

1. **Separation of Concerns:** Business logic separated from provider implementation
2. **Dependency Inversion:** Services depend on abstractions, not concrete providers
3. **Open/Closed Principle:** Easy to add new providers without modifying existing code
4. **Single Responsibility:** Each component has one clear purpose
5. **Configuration over Code:** Provider selection via environment variables

---

## System Components

### 1. SMS Service (Facade)

**Location:** `/src/sms/sms.service.ts`

**Responsibilities:**
- Provides unified API for sending SMS (`sendSms`, `sendBulkSms`)
- Implements geographic routing (Kenya → Africa's Talking, others → Twilio)
- Delegates to provider factory for provider selection
- Records metrics for all SMS operations
- Handles errors and logging
- Maintains service-level abstractions

**Key Methods:**
```typescript
async sendSms(dto: SendSmsDto): Promise<void>
async sendBulkSms(dto: SendBulkSmsDto): Promise<void>
```

**Dependencies:**
- `SmsProviderFactory` - Provider instantiation
- `SmsMetricsService` - Metrics collection

**Geographic Routing:**
- Kenyan numbers (+254) → Africa's Talking (cost-effective, local coverage)
- All other numbers → Default provider (Twilio)

### 2. Provider Factory

**Location:** `/src/sms/providers/sms-provider.factory.ts`

**Responsibilities:**
- Creates provider instances based on configuration or specific type
- Manages provider lifecycle
- Provides default provider (Twilio)
- Supports creating specific providers for geographic routing
- Logs provider selection decisions

**Configuration:**
```env
SMS_PROVIDER=twilio  # or 'africastalking'
```

**Provider Selection Logic:**
1. Read `SMS_PROVIDER` environment variable (for default provider)
2. If not set or invalid, default to `twilio`
3. Support explicit provider type parameter for geographic routing
4. Return appropriate provider instance
5. Log provider selection for observability

**Method Signature:**
```typescript
createProvider(providerType?: SmsProviderType): ISmsProvider
```

### 3. Provider Interface

**Location:** `/src/sms/interfaces/sms-provider.interface.ts`

**Responsibilities:**
- Defines contract for all SMS providers
- Ensures consistent API across providers
- Enables polymorphism and testability

**Interface Definition:**
```typescript
export interface ISmsProvider {
  sendSms(message: string, receiver: string): Promise<SendSmsResult>;
  sendBulkSms(message: string, receivers: string[]): Promise<SendBulkSmsResult>;
  getProviderName(): string;
}
```

### 4. Provider Implementations

#### Twilio Provider

**Location:** `/src/sms/providers/twilio.provider.ts`

**Features:**
- Official Twilio Node.js SDK integration
- TypeScript type support
- Batched bulk sending (10 messages/batch)
- Rate limiting (1 second delay between batches)
- Comprehensive error handling
- **Dual authentication:** API Key (recommended) or Auth Token

**Configuration:**
```env
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_PHONE_NUMBER=+16182688254

# Authentication (choose one):
# Option 1: API Key Authentication (RECOMMENDED - more secure)
TWILIO_API_KEY_SID=SKxxxxx
TWILIO_API_KEY_SECRET=xxxxx

# Option 2: Auth Token Authentication (fallback)
TWILIO_AUTH_TOKEN=xxxxx
```

**Authentication Methods:**
- **API Key (Recommended):** Provides better security through credential rotation, granular permissions, and easy revocation without affecting main account
- **Auth Token (Fallback):** Uses main account credentials, suitable for development but less secure for production

#### Africa's Talking Provider

**Location:** `/src/sms/providers/africastalking.provider.ts`

**Features:**
- Official Africa's Talking SDK integration
- Native bulk SMS support
- Optimized for African mobile networks
- Cost-effective for Kenya and East Africa

**Configuration:**
```env
SMS_AT_API_KEY=xxxxx
SMS_AT_USERNAME=xxxxx
SMS_AT_FROM=SENDER_ID
SMS_AT_KEYWORD=xxxxx
```

### 5. Metrics Service

**Location:** `/src/sms/sms.metrics.ts`

**Responsibilities:**
- Collect SMS operation metrics via OpenTelemetry
- Track success/failure rates by provider
- Monitor latency (P50, P95, P99)
- Record error types and frequencies
- Enable data-driven optimization

**Metrics Collected:**
- `sms.sent.count` - Total SMS sent
- `sms.failed.count` - Total SMS failures
- `sms.duration` - Send operation latency
- `sms.message_length` - Message size distribution
- `sms.provider` - Provider usage distribution

### 6. SMS Controller

**Location:** `/src/sms/sms.controller.ts`

**Responsibilities:**
- Exposes HTTP endpoints for SMS operations (if needed)
- Validates incoming requests
- Maps HTTP DTOs to service calls
- Returns appropriate HTTP status codes

**Endpoints (if exposed):**
- `POST /sms` - Send single SMS
- `POST /sms/bulk` - Send bulk SMS

---

## Design Patterns

### 1. Strategy Pattern

**Purpose:** Enable runtime provider selection without changing client code

**Implementation:**
```typescript
// Strategy Interface
interface ISmsProvider {
  sendSms(...): Promise<...>;
}

// Concrete Strategies
class TwilioProvider implements ISmsProvider { ... }
class AfricasTalkingProvider implements ISmsProvider { ... }

// Context
class SmsService {
  constructor(private provider: ISmsProvider) {}
}
```

**Benefits:**
- Easy to add new providers
- Testable with mock providers
- No coupling to specific implementations

### 2. Factory Pattern

**Purpose:** Centralize provider instantiation logic

**Implementation:**
```typescript
class SmsProviderFactory {
  createProvider(): ISmsProvider {
    const type = this.config.get('SMS_PROVIDER', 'twilio');
    switch (type) {
      case 'twilio': return this.twilioProvider;
      case 'africastalking': return this.atProvider;
      default: return this.twilioProvider;
    }
  }
}
```

**Benefits:**
- Single place for provider selection logic
- Easy configuration management
- Centralized logging of provider choices

### 3. Facade Pattern

**Purpose:** Provide simplified interface to complex subsystem

**Implementation:**
```typescript
class SmsService {
  async sendSms(dto: SendSmsDto): Promise<void> {
    // Simplified interface hides:
    // - Provider selection
    // - Metrics collection
    // - Error handling
    // - Logging
  }
}
```

**Benefits:**
- Consumers don't need to know about providers
- Consistent API across the application
- Easy to add cross-cutting concerns (metrics, logging)

### 4. Dependency Injection

**Purpose:** Decouple components and improve testability

**Implementation:**
```typescript
@Injectable()
class SmsService {
  constructor(
    private readonly providerFactory: SmsProviderFactory,
    private readonly metricsService: SmsMetricsService,
  ) {}
}
```

**Benefits:**
- Testable with mock dependencies
- Flexible component composition
- NestJS framework integration

---

## Application Scenarios

### 1. User Authentication (OTP)

**Scenario:** User logs in or performs sensitive operation

**Flow:**
1. User initiates login
2. Auth service generates 6-digit OTP
3. Auth service calls `smsService.sendSms()` with OTP message
4. SMS sent via configured provider
5. User receives OTP and completes authentication

**Code Example:**
```typescript
// In auth.service.ts
async sendOtp(phoneNumber: string): Promise<void> {
  const otp = this.generateOtp();
  await this.smsService.sendSms({
    receiver: phoneNumber,
    message: `Your Bitsacco verification code is: ${otp}. Valid for 10 minutes.`,
  });
}
```

**Message Template:**
```
Your Bitsacco verification code is: 123456. Valid for 10 minutes.
```

**Requirements:**
- Delivery within 30 seconds
- High reliability (>99% success rate)
- Security: OTP not logged in plain text
- Expiry tracking

### 2. Chama Invitations

**Scenario:** Chama admin invites members to join savings group

**Flow:**
1. Admin creates chama and adds member phone numbers
2. Chama service calls `smsService.sendBulkSms()` with invite message
3. Batch processing sends to all members
4. Members receive invite with join link/code
5. Metrics track delivery success per member

**Code Example:**
```typescript
// In chamas.messaging.ts
async sendInvites(chamaName: string, members: string[]): Promise<void> {
  await this.smsService.sendBulkSms({
    receivers: members,
    message: `You've been invited to join "${chamaName}" chama on Bitsacco. Reply YES to accept.`,
  });
}
```

**Message Template:**
```
You've been invited to join "Tumaini Savings" chama on Bitsacco. Reply YES to accept or visit bitsacco.com/join/ABC123
```

**Requirements:**
- Cost-efficient bulk sending
- Batch processing for 10+ members
- Individual delivery tracking
- Rate limiting to avoid carrier blocks

### 3. Transaction Notifications

**Scenario:** User receives or sends Bitcoin

**Flow:**
1. Lightning payment completes
2. Wallet service triggers notification event
3. Notification service calls `smsService.sendSms()` with transaction details
4. User receives real-time alert
5. Metrics track notification delivery

**Code Example:**
```typescript
// In notifications/notification.service.ts
async notifyTransaction(userId: string, amount: number, type: 'receive' | 'send'): Promise<void> {
  const phone = await this.getUserPhone(userId);
  const message = type === 'receive'
    ? `You received ${amount} sats on Bitsacco. Balance: ${newBalance} sats`
    : `You sent ${amount} sats on Bitsacco. Balance: ${newBalance} sats`;

  await this.smsService.sendSms({
    receiver: phone,
    message,
  });
}
```

**Message Template:**
```
You received 10,000 sats on Bitsacco. New balance: 50,000 sats. Txn: abc123def
```

**Requirements:**
- Real-time delivery (<1 minute)
- Transaction ID included
- Balance update
- Security: No sensitive details in SMS

### 4. Chama Withdrawal Approvals

**Scenario:** Multi-sig chama requires member approval for withdrawal

**Flow:**
1. Member initiates withdrawal request
2. Chama service identifies required approvers
3. Bulk SMS sent to all approvers
4. Approvers receive notification with approval link
5. Consensus tracked via responses

**Code Example:**
```typescript
// In chamas.messaging.ts
async requestWithdrawalApproval(
  chamaName: string,
  amount: number,
  approvers: string[],
): Promise<void> {
  await this.smsService.sendBulkSms({
    receivers: approvers,
    message: `${chamaName}: Withdrawal request for ${amount} sats requires your approval. Reply APPROVE or REJECT.`,
  });
}
```

**Message Template:**
```
Tumaini Savings: Withdrawal request for 100,000 sats requires your approval. Reply APPROVE or REJECT. Request ID: WR-12345
```

**Requirements:**
- Time-sensitive delivery
- Clear call-to-action
- Request tracking ID
- Audit trail for compliance

### 5. System Alerts

**Scenario:** Critical system event requires user attention

**Flow:**
1. System detects critical event (security alert, failed payment, etc.)
2. Alert service triggers SMS notification
3. User receives immediate alert
4. User takes corrective action

**Code Example:**
```typescript
// In alerts/alerts.service.ts
async sendSecurityAlert(userId: string, event: string): Promise<void> {
  const phone = await this.getUserPhone(userId);
  await this.smsService.sendSms({
    receiver: phone,
    message: `SECURITY ALERT: ${event}. If this wasn't you, secure your account immediately at bitsacco.com/security`,
  });
}
```

**Message Template:**
```
SECURITY ALERT: New device login detected from Nairobi, Kenya. If this wasn't you, secure your account at bitsacco.com/security
```

**Requirements:**
- Highest priority delivery
- Clear, actionable language
- Security-focused messaging
- No delay tolerance

---

## Provider Integration

### Provider Selection Strategy

**Default Provider: Twilio**
- **Reason:** Global coverage, excellent TypeScript SDK, reliable delivery
- **Use cases:** International users, development/staging environments
- **Cost:** Higher per-message cost, premium reliability

**Alternative Provider: Africa's Talking**
- **Reason:** Optimized for African markets, cost-effective, local presence
- **Use cases:** Kenya/East Africa users, bulk messages, cost optimization
- **Cost:** Lower per-message cost for African destinations

**Configuration:**
```env
# Default: Twilio
SMS_PROVIDER=twilio

# Alternative: Africa's Talking
SMS_PROVIDER=africastalking
```

### Provider Capabilities Comparison

| Feature | Twilio | Africa's Talking |
|---------|--------|------------------|
| TypeScript SDK | ✅ Native | ⚠️ Community |
| Bulk Send API | ❌ (manual batching) | ✅ Native |
| Global Coverage | ✅ 180+ countries | ⚠️ Africa-focused |
| Delivery Reports | ✅ Webhooks | ✅ Webhooks |
| Rate Limiting | High (1000/sec) | Medium (100/sec) |
| Cost (Kenya) | $0.05-0.10/SMS | $0.01-0.02/SMS |
| Cost (US) | $0.0079/SMS | Not optimal |
| Two-way SMS | ✅ | ✅ |
| Sender ID | ✅ | ✅ |

### Adding New Providers

To add a new provider (e.g., AWS SNS, MessageBird):

1. **Create Provider Class:**
   ```typescript
   // src/sms/providers/new-provider.provider.ts
   @Injectable()
   export class NewProvider implements ISmsProvider {
     async sendSms(message: string, receiver: string): Promise<SendSmsResult> {
       // Implementation
     }

     async sendBulkSms(message: string, receivers: string[]): Promise<SendBulkSmsResult> {
       // Implementation
     }

     getProviderName(): string {
       return 'new-provider';
     }
   }
   ```

2. **Register in Module:**
   ```typescript
   // src/sms/sms.module.ts
   @Module({
     providers: [
       // ... existing providers
       NewProvider,
     ],
   })
   export class SmsModule {}
   ```

3. **Update Factory:**
   ```typescript
   // src/sms/providers/sms-provider.factory.ts
   createProvider(): ISmsProvider {
     const type = this.config.get('SMS_PROVIDER', 'twilio');
     switch (type) {
       case 'twilio': return this.twilioProvider;
       case 'africastalking': return this.atProvider;
       case 'new-provider': return this.newProvider; // Add this
       default: return this.twilioProvider;
     }
   }
   ```

4. **Add Configuration:**
   ```env
   # .env.example
   SMS_PROVIDER=new-provider
   NEW_PROVIDER_API_KEY=xxx
   NEW_PROVIDER_CONFIG=xxx
   ```

5. **Write Tests:**
   ```typescript
   // src/sms/providers/new-provider.spec.ts
   describe('NewProvider', () => {
     // Unit tests
   });
   ```

---

## Geographic Routing Implementation

### Overview

The SMS service implements intelligent geographic routing to optimize cost and delivery rates by automatically selecting the most appropriate provider based on the recipient's phone number.

### Routing Logic

```typescript
// In SmsService constructor
this.defaultProvider = this.providerFactory.createProvider();
this.africasTalkingProvider = this.providerFactory.createProvider('africastalking');

private getProviderForNumber(phoneNumber: string): ISmsProvider {
  // Route Kenyan numbers (+254) to Africa's Talking
  if (phoneNumber.startsWith('+254')) {
    return this.africasTalkingProvider;
  }
  
  // Use default provider for all other numbers
  return this.defaultProvider;
}
```

### Benefits

1. **Cost Optimization:** 80% cost savings for Kenyan SMS (Africa's Talking vs Twilio)
2. **Better Delivery:** Local providers often have better carrier relationships
3. **Automatic Selection:** No manual provider switching required
4. **Fallback Support:** Each provider has independent configuration

### Bulk SMS Geographic Routing

For bulk messages, the service automatically splits recipients by geography:

```typescript
async sendBulkSms({ message, receivers }: SendBulkSmsDto): Promise<void> {
  // Group receivers by provider
  const kenyanNumbers = receivers.filter(num => num.startsWith('+254'));
  const otherNumbers = receivers.filter(num => !num.startsWith('+254'));

  // Send to each group via appropriate provider
  if (kenyanNumbers.length > 0) {
    await this.africasTalkingProvider.sendBulkSms(message, kenyanNumbers);
  }
  
  if (otherNumbers.length > 0) {
    await this.defaultProvider.sendBulkSms(message, otherNumbers);
  }
}
```

### Metrics Tracking

Each provider's usage is tracked separately in metrics:

```typescript
this.metricsService.recordSmsMetric({
  receiver,
  messageLength: message.length,
  success: true,
  duration: Date.now() - startTime,
  provider: provider.getProviderName(), // 'twilio' or 'africastalking'
});
```

---

## Message Flow

### Single SMS Flow

```
┌──────────────┐
│ Auth Service │
└──────┬───────┘
       │ sendOtp(phone)
       │
       ▼
┌──────────────────┐
│  SMS Service     │
│  (Facade)        │
└──────┬───────────┘
       │ sendSms({message, receiver})
       │
       ▼
┌──────────────────┐
│ Metrics Service  │ ◄─── Record start time
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ Provider Factory │
└──────┬───────────┘
       │ getProvider() → TwilioProvider
       │
       ▼
┌──────────────────┐
│ Twilio Provider  │
└──────┬───────────┘
       │ messages.create({...})
       │
       ▼
┌──────────────────┐
│   Twilio API     │
└──────┬───────────┘
       │ HTTP POST
       │
       ▼
┌──────────────────┐
│  User's Phone    │ ◄─── SMS delivered
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ Metrics Service  │ ◄─── Record success, duration
└──────────────────┘
```

### Bulk SMS Flow

```
┌──────────────┐
│Chama Service │
└──────┬───────┘
       │ sendInvites([phones])
       │
       ▼
┌──────────────────┐
│  SMS Service     │
└──────┬───────────┘
       │ sendBulkSms({message, receivers[]})
       │
       ▼
┌──────────────────┐
│ Provider Factory │
└──────┬───────────┘
       │ getProvider() → TwilioProvider
       │
       ▼
┌──────────────────┐
│ Twilio Provider  │
│ (Batching)       │
└──────┬───────────┘
       │
       ├─ Batch 1 (10 receivers) ──────┐
       │  Wait 1 second                 │
       ├─ Batch 2 (10 receivers) ──────┤
       │  Wait 1 second                 │
       └─ Batch N (remaining) ──────────┤
                                        │
                                        ▼
                              ┌──────────────────┐
                              │   Twilio API     │
                              └──────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
              ┌──────────┐     ┌──────────┐    ┌──────────┐
              │ Phone 1  │     │ Phone 2  │    │ Phone N  │
              └──────────┘     └──────────┘    └──────────┘
                    │                │                │
                    └────────────────┼────────────────┘
                                     ▼
                           ┌──────────────────┐
                           │ Metrics Service  │ ◄─── Record batch results
                           └──────────────────┘
```

### Error Handling Flow

```
┌──────────────┐
│ SMS Service  │
└──────┬───────┘
       │ sendSms()
       │
       ▼
┌──────────────────┐
│ Twilio Provider  │
└──────┬───────────┘
       │ messages.create()
       │
       ▼
┌──────────────────┐
│   Twilio API     │
└──────┬───────────┘
       │
       ▼
    [ERROR]
       │
       ▼
┌──────────────────┐
│ Twilio Provider  │ ◄─── Log error with stack trace
└──────┬───────────┘
       │ throw error
       │
       ▼
┌──────────────────┐
│  SMS Service     │ ◄─── Catch error
└──────┬───────────┘
       │ Record failure metrics
       │
       ▼
┌──────────────────┐
│ Metrics Service  │ ◄─── Record {success: false, errorType: '...'}
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ Calling Service  │ ◄─── Propagate error or handle gracefully
│ (Auth/Chama)     │
└──────────────────┘
```

---

## Security Considerations

### 1. Credential Management

**Requirements:**
- All API keys and tokens stored in environment variables
- Never committed to version control
- Encrypted at rest in production
- Rotated regularly (every 90 days for API Keys, quarterly for Auth Tokens)

**Twilio Authentication (Dual Support):**

*API Key Authentication (Recommended for Production):*
```typescript
// ConfigService loads API Key credentials
const apiKeySid = this.configService.get<string>('TWILIO_API_KEY_SID');
const apiKeySecret = this.configService.get<string>('TWILIO_API_KEY_SECRET');
const accountSid = this.configService.getOrThrow<string>('TWILIO_ACCOUNT_SID');

if (apiKeySid && apiKeySecret) {
  this.client = twilio(apiKeySid, apiKeySecret, { accountSid });
}
```

*Auth Token Authentication (Fallback):*
```typescript
// Falls back to Auth Token if API Key not provided
const authToken = this.configService.getOrThrow<string>('TWILIO_AUTH_TOKEN');
this.client = twilio(accountSid, authToken);
```

**Benefits of API Key Authentication:**
- **Rotation:** Rotate credentials without changing main account Auth Token
- **Revocation:** Instantly revoke compromised keys without service disruption
- **Permissions:** Create API Keys with limited scopes (e.g., SMS-only)
- **Audit:** Track which API Key performed each action
- **Security:** Reduces risk of main account compromise

**Storage:**
- Development: `.env` file (git-ignored)
- Staging/Production: AWS Secrets Manager, HashiCorp Vault, or similar
- **Never** commit `.env` files or credentials to version control

### 2. Message Content Security

**Requirements:**
- Never include passwords or full credit card numbers
- OTPs sent once, not resent via SMS
- Transaction IDs obfuscated (last 6 chars only)
- No PII (Personally Identifiable Information) in logs

**Implementation:**
```typescript
// Good: Obfuscated transaction ID
`Transaction ${txId.slice(-6)} completed`

// Bad: Full transaction ID
`Transaction ${txId} completed`

// Good: No PII in logs
this.logger.log(`SMS sent to user ${userId}`);

// Bad: Phone number in logs
this.logger.log(`SMS sent to ${phoneNumber}`);
```

### 3. Rate Limiting

**Requirements:**
- Per-user rate limits (e.g., 5 SMS per hour)
- Global rate limits to prevent abuse
- Provider-specific rate limits respected

**Implementation:**
```typescript
// In SMS service
async sendSms(dto: SendSmsDto): Promise<void> {
  await this.rateLimiter.checkLimit(dto.receiver);
  // ... send SMS
}
```

**Limits:**
- OTP: 5 per user per hour
- Transaction notifications: 100 per user per day
- Chama invites: 50 per chama per day

### 4. Audit Logging

**Requirements:**
- All SMS sends logged (without message content)
- Metadata: timestamp, receiver (hashed), provider, result
- Retained for compliance (90 days minimum)

**Implementation:**
```typescript
this.logger.log({
  event: 'sms.sent',
  receiverHash: hash(receiver),
  provider: this.provider.getProviderName(),
  messageLength: message.length,
  success: true,
  timestamp: new Date().toISOString(),
});
```

### 5. Input Validation

**Requirements:**
- Phone numbers validated against E.164 format
- Message length validated (160 chars for single segment)
- Receiver lists validated (max 100 per bulk request)

**Implementation:**
```typescript
// DTO validation
export class SendSmsDto {
  @IsPhoneNumber()
  receiver: string;

  @Length(1, 160)
  message: string;
}
```

---

## Monitoring and Observability

### Metrics

**Provider Metrics:**
- `sms.provider.requests` - Total requests per provider
- `sms.provider.success_rate` - Success rate by provider (%)
- `sms.provider.latency` - P50, P95, P99 latency by provider
- `sms.provider.error_rate` - Error rate by provider and error type

**Business Metrics:**
- `sms.scenario.otp` - OTP delivery success rate
- `sms.scenario.transaction` - Transaction notification success rate
- `sms.scenario.chama` - Chama message success rate
- `sms.cost` - Estimated cost per provider (if webhook available)

**System Metrics:**
- `sms.queue.depth` - Pending SMS in queue
- `sms.rate_limit.hit` - Rate limit violations
- `sms.retry.count` - Retry attempts

### Logging

**Log Levels:**
```typescript
// INFO: Normal operations
this.logger.log('SMS sent successfully');

// WARN: Recoverable issues
this.logger.warn('Provider rate limit approaching');

// ERROR: Failed operations
this.logger.error('SMS send failed', error.stack);
```

**Structured Logging:**
```typescript
this.logger.log({
  level: 'info',
  event: 'sms.sent',
  provider: 'twilio',
  duration: 234,
  success: true,
  metadata: {
    messageLength: 45,
    receiverCountry: 'KE',
  },
});
```

### Alerting

**Critical Alerts:**
- Provider failure rate >10% (5 min window)
- All providers down
- Credentials expired/invalid
- Daily cost >$100 (unexpected spike)

**Warning Alerts:**
- Provider failure rate >5% (15 min window)
- Latency P95 >5 seconds
- Rate limit violations >10/hour

**Alert Channels:**
- PagerDuty for critical alerts
- Slack for warning alerts
- Email for daily summaries

### Dashboards

**Operations Dashboard:**
- Real-time success rate by provider
- Latency percentiles (P50, P95, P99)
- Error distribution by type
- Active provider usage

**Business Dashboard:**
- SMS volume by scenario (OTP, transaction, chama)
- Cost per scenario
- User engagement metrics (delivery rate, response rate)
- Monthly cost trends

---

## Future Enhancements

### 1. Automatic Failover

**Capability:** Automatically switch to backup provider on failure

**Implementation:**
```typescript
async sendSms(message: string, receiver: string): Promise<void> {
  try {
    await this.primaryProvider.sendSms(message, receiver);
  } catch (error) {
    this.logger.warn('Primary provider failed, using fallback');
    await this.fallbackProvider.sendSms(message, receiver);
  }
}
```

**Benefits:**
- Higher availability (99.9%+)
- Reduced manual intervention
- Seamless user experience

### 2. Smart Routing ✅ IMPLEMENTED

**Status:** Currently implemented for geographic routing

**Current Implementation:**
```typescript
private getProviderForNumber(phoneNumber: string): ISmsProvider {
  // Route Kenyan numbers (+254) to Africa's Talking
  if (phoneNumber.startsWith('+254')) {
    return this.africasTalkingProvider;
  }
  
  // Use default provider for all other numbers
  return this.defaultProvider;
}
```

**Benefits Realized:**
- Cost optimization for Kenyan users (80% cost savings)
- Better delivery rates in Kenya
- Automatic provider selection

**Future Extensions:**
- Additional country routing rules
- Cost-based routing decisions
- Time-of-day routing optimization

### 3. Message Templating

**Capability:** Centralized message templates with variable substitution

**Implementation:**
```typescript
// Template registry
const templates = {
  otp: 'Your Bitsacco code is: {{code}}. Valid for {{minutes}} minutes.',
  transaction: 'You {{type}} {{amount}} sats. Balance: {{balance}} sats.',
};

// Usage
await this.smsService.sendTemplate('otp', {
  receiver: phone,
  variables: { code: '123456', minutes: 10 },
});
```

**Benefits:**
- Consistent messaging
- Easy localization (future)
- A/B testing support

### 4. Delivery Status Webhooks

**Capability:** Track message delivery status in real-time

**Implementation:**
```typescript
// Webhook endpoint
@Post('webhooks/twilio/status')
async handleDeliveryStatus(@Body() payload: TwilioWebhook) {
  const { MessageSid, MessageStatus } = payload;

  await this.updateMessageStatus(MessageSid, MessageStatus);

  if (MessageStatus === 'failed') {
    await this.retryMessage(MessageSid);
  }
}
```

**Benefits:**
- Real-time delivery tracking
- Automatic retry on failure
- Better metrics accuracy

### 5. Two-Way SMS

**Capability:** Receive and process SMS replies from users

**Implementation:**
```typescript
// Webhook endpoint
@Post('webhooks/twilio/incoming')
async handleIncomingSms(@Body() payload: IncomingSms) {
  const { From, Body } = payload;

  if (Body.toUpperCase() === 'YES') {
    await this.chamaService.confirmInvite(From);
  } else if (Body.toUpperCase() === 'APPROVE') {
    await this.chamaService.approveWithdrawal(From);
  }
}
```

**Use Cases:**
- Chama invite confirmations
- Withdrawal approvals
- User preferences (STOP to unsubscribe)

### 6. Queue-Based Processing

**Capability:** Decouple SMS sending from business logic with message queue

**Implementation:**
```typescript
// Producer (Auth Service)
await this.queue.publish('sms.send', {
  receiver: phone,
  message: `Your code is ${otp}`,
  priority: 'high',
});

// Consumer (SMS Worker)
@OnQueueActive()
async processSms(job: Job<SmsSendJob>) {
  await this.smsService.sendSms(job.data);
}
```

**Benefits:**
- Improved reliability
- Rate limiting at queue level
- Retry mechanisms
- Priority handling

---

## Conclusion

The Bitsacco SMS integration provides a robust, flexible, and scalable foundation for SMS communications. Key strengths:

1. **Multi-Provider Support:** Easy switching between Twilio and Africa's Talking
2. **Clean Architecture:** Strategy pattern enables extensibility
3. **Observable:** Comprehensive metrics and logging
4. **Secure:** Credential management and audit trails
5. **Business-Aligned:** Direct support for core Bitsacco scenarios

This architecture supports current needs while providing clear paths for future enhancements like automatic failover, smart routing, and two-way SMS.

---

## References

- [Twilio Documentation](https://www.twilio.com/docs)
- [Africa's Talking Documentation](https://developers.africastalking.com/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [OpenTelemetry Metrics](https://opentelemetry.io/docs/specs/otel/metrics/)
- Migration Plan: `/docs/twilio-sms-migration.md`
- Metrics Documentation: `/docs/metrics.md`
