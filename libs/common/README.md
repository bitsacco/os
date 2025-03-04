# @bitsacco/common

Common utilities, services, and types for the Bitsacco platform.

## Installation

```bash
npm install @bitsacco/common
# or
yarn add @bitsacco/common
# or
bun add @bitsacco/common
```

## Features

- Authentication utilities (JWT, Npub, Phone)
- Database abstractions
- Common DTOs
- Fedimint service
- Logging utilities
- User management
- Currency utilities

## Publishing

This package is automatically published to npm via GitHub Actions when:

1. A tag with format `common-v*` is pushed (e.g., `common-v0.1.1`)
2. The workflow is manually triggered with a specified version

### Manual Publishing

To manually publish a new version:

1. Go to the GitHub Actions tab in the repository
2. Select the "Publish @bitsacco/common" workflow
3. Click "Run workflow"
4. Enter the version number and click "Run workflow"

## License

MIT
