# Bitsacco OS Development Guide

## Build & Test Commands
- Build all: `bun build`
- Build specific app: `bun build:<app>` (admin|server|swap)
- Lint: `bun lint`
- Format: `bun format`
- Test: `bun test`
- Test single file: `bun test path/to/file.spec.ts`
- Test coverage: `bun test --coverage`
- Run development: `bun dev`

## Publishing Commands
- Package @bitsacco/common: `cd libs/common && ./package.sh`
- Publish to npm: Create a tag with format `common-v*` (e.g. `common-v0.1.1`) or trigger the GitHub Actions workflow manually

## Code Style Guidelines
- Use **NestJS** patterns with controllers, services, and modules
- Imports: Absolute imports using paths in tsconfig.json (`@bitsacco/common`, `@bitsacco/testing`)
- Formatting: Single quotes, trailing commas (enforced by Prettier)
- Naming: PascalCase for classes/interfaces, camelCase for variables/functions/methods
- Error handling: Use NestJS exceptions (`throw new BadRequestException()`)
- Testing: Use `createTestingModuleWithValidation` from `@bitsacco/testing`
- Types: TypeScript with gRPC protocol buffers
- Follow NestJS dependency injection pattern for services