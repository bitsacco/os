# Bitsacco Server

A consolidated monolithic server that combines multiple microservices into a single deployable unit for simplified operations and improved performance.

## Architecture Overview

This monolith consolidates the following services:
- **Authentication Service** - User registration, login, JWT/API key management
- **Chama Service** - Group savings circles management
- **Wallet Service** - Individual Lightning wallet operations
- **Shares Service** - Investment shares marketplace
- **Notification Service** - Multi-channel notification delivery
- **Communication Service** - SMS and Nostr messaging

**External Dependencies:**
- **Swap Service** - Remains as independent microservice (gRPC integration)
- **MongoDB** - Unified database with shared connection pool
- **Redis** - Caching and event bus
- **Fedimint** - Bitcoin Lightning Network operations

## Features

### 🏗️ **Domain-Driven Architecture**
- Clear domain boundaries with event-driven communication
- Shared infrastructure for monitoring, database, and security
- Extensible API gateway supporting REST, WebSocket, and gRPC

### 📊 **Comprehensive Monitoring**
- OpenTelemetry distributed tracing
- Prometheus metrics with business KPIs
- Real-time health checks and system metrics
- Grafana dashboards for visualization

### 🔒 **Enterprise Security**
- JWT and API key authentication
- Rate limiting and CSRF protection
- Security headers and input validation
- Role-based access control

### 🚀 **High Performance**
- Single process deployment
- Shared database connection pooling
- Event-driven internal communication
- WebSocket real-time updates

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- MongoDB
- Redis

### Development Setup

1. **Clone and install dependencies:**
```bash
cd apps/server
npm install
```

2. **Environment configuration:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start with Docker Compose:**
```bash
docker-compose up -d
```

4. **Start in development mode:**
```bash
npm run start:dev
```

### Production Deployment

```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

## API Endpoints

### Base URL: `http://localhost:4000/api/v1`

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile

### Chamas
- `GET /chamas` - List user's chamas
- `POST /chamas` - Create new chama
- `GET /chamas/:id` - Get chama details
- `PUT /chamas/:id` - Update chama
- `POST /chamas/:id/join` - Join chama

### Wallets
- `GET /wallets` - Get user wallets
- `POST /wallets/send` - Send transaction
- `POST /wallets/receive` - Create receive invoice
- `GET /wallets/transactions` - Transaction history

### Shares
- `GET /shares/offers` - List share offers
- `POST /shares/buy` - Purchase shares
- `POST /shares/sell` - Sell shares
- `GET /shares/portfolio` - Get portfolio

### Notifications
- `GET /notifications` - Get notifications
- `PUT /notifications/:id/read` - Mark as read
- `PUT /notifications/preferences` - Update preferences

## WebSocket Events

Connect to: `ws://localhost:4001/events`

### Event Types
- `user.*` - User-related events
- `chama.*` - Chama events
- `wallet.*` - Transaction events
- `notification.*` - Notification events
- `shares.*` - Shares marketplace events

### Example Usage
```javascript
const socket = io('http://localhost:4001/events');

socket.emit('authenticate', { token: 'your-jwt-token' });
socket.emit('subscribe', { events: ['chama.*', 'wallet.*'] });

socket.on('domain_event', (event) => {
  console.log('Received event:', event);
});
```

## Health Checks

- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed health with metrics
- `GET /api/v1/health/ready` - Kubernetes readiness probe
- `GET /api/v1/health/live` - Kubernetes liveness probe

## Monitoring

### Metrics Endpoint
- `GET /metrics` - Prometheus metrics

### Grafana Dashboards
- **Business Metrics**: User registrations, transactions, chama activity
- **Technical Metrics**: Response times, error rates, database performance
- **System Metrics**: Memory, CPU, connection pools

### Key Metrics
- `bitsacco_http_requests_total` - HTTP request counter
- `bitsacco_db_operations_total` - Database operation counter
- `bitsacco_transactions_total` - Business transaction counter
- `bitsacco_auth_attempts_total` - Authentication attempts
- `bitsacco_websocket_connections_active` - Active WebSocket connections

## Configuration

### Environment Variables

```bash
# Application
NODE_ENV=development
PORT=4000
WEBSOCKET_PORT=4001
GRPC_PORT=4002

# Database
MONGODB_URI=mongodb://localhost:27017/bitsacco
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# External Services
SWAP_SERVICE_URL=http://localhost:4040
AFRICAS_TALKING_API_KEY=your-api-key
FEDIMINT_CLIENT_URL=http://localhost:7070

# Monitoring
PROMETHEUS_PORT=9090
TELEMETRY_ENABLED=true
```

## Domain Structure

```
src/
├── domains/                 # Business domains
│   ├── auth/               # Authentication & authorization
│   ├── chamas/             # Group savings circles
│   ├── wallets/            # Lightning wallets
│   ├── shares/             # Investment shares
│   ├── notifications/      # Notification management
│   └── communications/     # SMS & Nostr messaging
├── api/                    # API layers
│   ├── rest/              # REST controllers
│   ├── websocket/         # WebSocket gateways
│   └── grpc/              # gRPC clients
├── infrastructure/        # Cross-cutting concerns
│   ├── database/          # MongoDB connection & repos
│   ├── monitoring/        # Metrics & telemetry
│   ├── security/          # Security middleware
│   └── messaging/         # Event bus & queues
└── shared/                # Shared utilities
    └── domain/            # Domain events & base classes
```

## Development

### Running Tests
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:cov        # Coverage report
npm run test:e2e        # End-to-end tests
```

### Code Quality
```bash
npm run lint            # ESLint
npm run format          # Prettier
```

### Database Operations
```bash
# Access MongoDB shell
docker-compose exec mongodb mongosh bitsacco

# View logs
docker-compose logs -f server
```

## Migration from Microservices

This monolith maintains API compatibility with the existing microservices architecture. The migration path:

1. **Phase 1**: Deploy monolith alongside existing services
2. **Phase 2**: Route traffic gradually to monolith
3. **Phase 3**: Decommission individual microservices
4. **Phase 4**: Optimize for monolithic patterns

## Contributing

1. Follow domain-driven design principles
2. Add comprehensive tests for new features
3. Update monitoring metrics for business operations
4. Document API changes in Swagger
5. Follow the existing code patterns and naming conventions

## License

MIT License - see LICENSE file for details