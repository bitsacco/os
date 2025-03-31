# Package Manager Usage

This project uses [Bun](https://bun.sh/) as its package manager. Please do not use npm, yarn, or pnpm.

## Why Bun?

- **Speed**: Bun is significantly faster than other package managers
- **Consistency**: Using a single package manager prevents lockfile conflicts
- **Built-in tools**: Bun provides testing, bundling, and TypeScript support

## Common Commands

- Installing dependencies: `bun install`
- Running scripts: `bun run <script-name>`
- Running tests: `bun test`
- Adding dependencies: `bun add <package-name>`
- Adding dev dependencies: `bun add -d <package-name>`

## Troubleshooting

If you encounter any issues related to package management, please make sure you're using Bun version 1.0.0 or higher.

To install or update Bun:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Update Bun
bun upgrade
```