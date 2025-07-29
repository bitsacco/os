# Bitsacco OS - Architecture

This document describes the microservice architecture implemented in the Bitsacco OS project.

## Table of Contents

- [Overview](#overview)
- [Microservices](#microservices)
- [Communication Patterns](#communication-patterns)
- [Code Sharing](#code-sharing)
- [Database](#database)
- [Logging](#logging)
- [Monitoring](#monitoring)
- [Deployment](#deployment)
- [Security](#security)

## Overview

Bitsacco OS is built using a microservice architecture to provide a scalable, resilient, and maintainable platform for Bitcoin financial services. The system is designed around domain-specific services that communicate via REST APIs, with MongoDB as the primary data store and Redis for caching.

The architecture emphasizes:

- **Domain-Driven Design**: Services are organized around business domains
- **Loose Coupling**: Services interact through well-defined interfaces
- **High Cohesion**: Related functionality is grouped together
- **Observability**: Comprehensive logging and monitoring
- **Resilience**: Fault tolerance and graceful degradation

## Microservices

The Bitsacco OS platform consists of the following microservices:

| Service | Description | Primary Responsibilities |
|---------|-------------|--------------------------|
| **API** | API Gateway | Routes requests, authentication, metrics federation |
| **Auth** | Authentication | User authentication, token management, registration |
| **Swap** | Currency Exchange | BTC/KES conversion, FX rates, payment processing |
| **Nostr** | Nostr Protocol | Nostr key management, event signing, relay interaction |
| **SMS** | SMS Communication | OTP delivery, notifications, verifications |
| **Shares** | Share Management | Share issuance, transfers, subscriptions |
| **SoloWallet** | Personal Wallet | Individual Bitcoin wallet management |
| **Chama** | Group Savings | Group savings management, contributions, distributions |

### Service Details

#### API Gateway

The API Gateway serves as the entry point for external clients, handling:

- Request routing to appropriate microservices
- Authentication and authorization
- Response format standardization
- Metrics federation

#### Auth Service

Manages user authentication and authorization:

- User registration and profile management
- Multiple authentication methods (phone, npub)
- JWT token issuance and validation
- OTP verification via SMS or Nostr

#### Swap Service

Handles currency exchange between Bitcoin and Kenyan Shillings (KES):

- Onramp (KES → BTC) transactions
- Offramp (BTC → KES) transactions
- FX rate management
- Third-party payment processor integration (IntaSend)

#### Nostr Service

Manages Nostr protocol interactions:

- Nostr key management
- Event signing and verification
- Relay communication
- NIP-07 and NIP-26 implementation

#### SMS Service

Handles SMS communication:

- OTP delivery
- Transaction notifications
- Marketing communications
- Provider abstraction (Africa's Talking)

#### Shares Service

Manages digital share operations:

- Share issuance and subscriptions
- Share transfers and ownership
- Dividend distribution
- Share offers and listings

#### SoloWallet Service

Manages individual Bitcoin wallets:

- Wallet creation and management
- Transaction history
- Lightning Network withdrawals via LNURL
- Balance tracking

#### Chama Service

Manages group savings groups (Chamas):

- Chama creation and membership
- Contribution tracking
- Fund distribution
- Group wallet management

## Communication Patterns

Bitsacco OS implements several communication patterns:

### Synchronous Communication

- **REST APIs**: External client communication and inter-service calls

### Asynchronous Communication

- **Event-Driven**: Using event emitters for loosely coupled communication
- **Message Queues**: For durable asynchronous processing (using Redis)

### Service Contracts

Service contracts are defined using TypeScript interfaces which:

- Provide type safety
- Support versioning
- Enable code generation

## Code Sharing

Common code is shared through:

### Common Library

The `@bitsacco/common` package contains:

- **DTOs**: Data Transfer Objects for API and inter-service communication
- **Validators**: Input validation logic
- **Auth**: Authentication and authorization utilities
- **Database**: MongoDB schemas and repository patterns
- **Monitoring**: Metrics collection and OpenTelemetry integration
- **Utils**: Helper functions and utilities
- **Constants**: Configuration constants and enums
- **Fedimint**: Fedimint client integration
- **Events**: Event definitions and types

The common library enforces standardization across the platform and reduces duplication.

### Testing

The application uses standard NestJS testing utilities:

- `Test.createTestingModule` for creating test modules
- Jest for test runner and assertions
- Mock services and repositories for unit testing
- Bun test runner for fast test execution

## Database

Bitsacco OS uses MongoDB as its primary database:

### Data Model

- **Document-Oriented**: Data stored in flexible, JSON-like documents
- **Schema Validation**: Using Mongoose schema definitions
- **Service Ownership**: Each service owns its data and schemas
- **References**: Using document references for relationships

### Repository Pattern

Data access is abstracted through repositories:

- **AbstractRepository**: Base repository class with CRUD operations
- **Service-Specific Repositories**: Extend the base repository with domain-specific methods
- **Schemas**: Mongoose schemas define document structure and validation

Example repository hierarchy:
```
AbstractRepository (common)
├── UserRepository (auth)
├── SharesRepository (shares)
├── WalletRepository (solowallet)
└── ChamaRepository (chama)
```

### Data Consistency

- **Transactions**: For operations requiring ACID properties
- **Optimistic Concurrency**: Using version fields
- **Eventual Consistency**: For cross-service data

## Logging

Logging is implemented throughout the platform:

### Logger Module

- **Structured Logging**: JSON-formatted logs with standardized fields
- **Log Levels**: ERROR, WARN, INFO, DEBUG, VERBOSE
- **Context Enrichment**: Adding request IDs, user IDs, service names
- **Log Interceptor**: Automatically logs HTTP requests/responses

### Log Content

Logs capture:
- Request/response details
- Error information and stack traces
- Performance metrics
- Business events
- System state changes

## Monitoring

The monitoring infrastructure provides comprehensive observability:

### Metrics Collection

- **OpenTelemetry**: For metrics instrumentation
- **Prometheus**: For metrics storage and querying
- **Grafana**: For visualization and alerting

### Standard Metrics

All services implement standard metrics:
- Operation counts (total, success, failure)
- Operation durations
- Error rates
- Resource utilization

### Service-Specific Metrics

Domain-specific metrics include:
- **Auth**: Login attempts, registration success, token operations
- **Swap**: Transaction volumes, currency rates, processing times
- **Shares**: Share transactions, ownership distribution
- **Chama**: Contribution metrics, distribution patterns
- **LNURL**: Lightning Network operation metrics

### Metric Implementation

Metrics are implemented using:
- **MetricsService**: Base service for standard metrics
- **OperationMetricsService**: For tracking operation outcomes
- **Service-Specific Services**: Extending the base classes for domain metrics

The metrics system is designed for:
- **Scalability**: Handles high-volume metric collection
- **Extensibility**: Easy to add new metrics
- **Low Overhead**: Minimal performance impact

## Deployment

Bitsacco OS supports multiple deployment models:

### Container Orchestration

- **Docker Compose**: For development and testing
- **Kubernetes**: For production deployment (not included in the codebase)

### Infrastructure Components

The infrastructure includes:
- **MongoDB**: Document database
- **Redis**: Caching and message queuing
- **Prometheus**: Metrics collection
- **Grafana**: Monitoring dashboards
- **Fedimint Client**: Federated mint client for Bitcoin operations

### Configuration

Services are configured via:
- Environment variables
- Configuration files
- Secrets management (in production)

### Scaling

The architecture supports:
- **Horizontal Scaling**: Adding more service instances
- **Vertical Scaling**: Increasing resources per instance
- **Database Sharding**: For large data volumes
- **Load Balancing**: For distributing traffic

## Security

Security is implemented at multiple layers:

### Authentication & Authorization

- **JWT Tokens**: For secure authentication
- **Role-Based Access**: Controlling resource access
- **OTP Verification**: For secure operations

### Communication Security

- **TLS/SSL**: Encrypted communications
- **API Keys**: For service-to-service authentication
- **Input Validation**: Preventing injection attacks

### Data Protection

- **Encryption**: For sensitive data at rest
- **Audit Logging**: Tracking access and changes
- **Secure Defaults**: Minimizing attack surface

### Bitcoin Security

- **Fedimint Integration**: Federated custody model
- **Multi-signature**: For high-value operations
- **Rate Limiting**: Preventing abuse

The security model follows defense-in-depth principles with multiple layers of protection.