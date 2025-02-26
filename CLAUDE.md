# Bitsacco OS Development Guide

## Build & Test Commands
- Build all: `bun build`
- Build specific app: `bun build:<app>` (auth|api|swap|nostr|sms|shares|solowallet|chama)
- Lint: `bun lint`
- Format: `bun format`
- Test: `bun test`
- Test single file: `bun test path/to/file.spec.ts`
- Test coverage: `bun test --coverage`
- Run development: `bun dev`

## Code Style Guidelines
- Use **NestJS** patterns with controllers, services, and modules
- Imports: Absolute imports using paths in tsconfig.json (`@bitsacco/common`, `@bitsacco/testing`)
- Formatting: Single quotes, trailing commas (enforced by Prettier)
- Naming: PascalCase for classes/interfaces, camelCase for variables/functions/methods
- Error handling: Use NestJS exceptions (`throw new BadRequestException()`)
- Testing: Use `createTestingModuleWithValidation` from `@bitsacco/testing`
- Types: TypeScript with gRPC protocol buffers
- Follow NestJS dependency injection pattern for services