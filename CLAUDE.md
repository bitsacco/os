# Bitsacco OS Development Guide

## Build & Test Commands
- Build all: `bun build`
- Lint: `bun lint`
- Format: `bun format`
- Test: `bun test`
- Test single file: `bun test path/to/file.spec.ts`
- Test coverage: `bun test --coverage`
- Run development: `bun dev`

## Publishing Commands
- This is now a single application, not a monorepo with published packages

## Code Style Guidelines
- Use **NestJS** patterns with controllers, services, and modules
- Imports: Use relative imports for internal modules
- Formatting: Single quotes, trailing commas (enforced by Prettier)
- Naming: PascalCase for classes/interfaces, camelCase for variables/functions/methods
- Error handling: Use NestJS exceptions (`throw new BadRequestException()`)
- Testing: Use standard NestJS testing with `Test.createTestingModule`
- Types: TypeScript
- Follow NestJS dependency injection pattern for services