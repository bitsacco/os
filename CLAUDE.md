# Bitsacco OS Development Guide

## Build & Test Commands

- Build all: `bun build`
- Build specific app: `bun build --filter=@bitsacco/<app>` (admin|server)
- Lint: `bun lint`
- Format: `bun format`
- Test: `bun test`
- Test single file: `bun test path/to/file.spec.ts`
- Test coverage: `bun test --coverage`
- Run development: `bun dev`

## Server Utilities

### API Key Management

- Help: `bun apikey` or `cd apps/server && bun run apikey`
- Generate: `bun apikey:generate`
- Create: `bun apikey:create`
- List: `bun apikey:list`
- Test: `bun apikey:test`

### Database Seeding

- Seed data: `bun seed` or `cd apps/server && bun run seed`
- Clean data: `bun seed:clean`

### Protocol Buffers

- Generate types: `bun proto:gen`
- Clean types: `bun proto:clean`

## Code Style Guidelines

- Use **NestJS** patterns with controllers, services, and modules
- Formatting: Single quotes, trailing commas (enforced by Prettier)
- Naming: PascalCase for classes/interfaces, camelCase for variables/functions/methods
- Error handling: Use NestJS exceptions (`throw new BadRequestException()`)

## Build Artifacts

The following directories are automatically ignored by formatting/linting tools:

- `.next/` - Next.js build output
- `.turbo/` - Turborepo cache
- `dist/` - TypeScript/NestJS build output
- `build/` - React build output
- `node_modules/` - Package dependencies
- `coverage/` - Test coverage reports
