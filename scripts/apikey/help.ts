#!/usr/bin/env node

/**
 * API Key Management Help Script
 * 
 * This script displays comprehensive help for all API key management commands.
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    crimson: '\x1b[38m'
  }
};

const commands = [
  {
    name: 'apikey:generate',
    description: 'Generate a global development API key',
    usage: 'bun apikey:generate',
    details: 'Creates a universal API key with all permissions for development purposes. Updates all .dev.env files with the key.'
  },
  {
    name: 'apikey:create',
    description: 'Create a new API key with custom scopes',
    usage: 'bun apikey:create',
    details: 'Interactive tool to create an API key with specific permissions and expiration date.'
  },
  {
    name: 'apikey:list',
    description: 'List all API keys in the database',
    usage: 'bun apikey:list',
    details: 'Shows all API keys with their details including status, scopes, expiration, and last used date.'
  },
  {
    name: 'apikey:revoke',
    description: 'Revoke an existing API key',
    usage: 'bun apikey:revoke',
    details: 'Interactive tool to select and revoke an API key, preventing its future use.'
  },
  {
    name: 'apikey:rotate',
    description: 'Rotate an existing service API key',
    usage: 'bun apikey:rotate',
    details: 'Creates a new API key for a service, updates its environment files, and revokes the old key. Used for regular key rotation.'
  },
  {
    name: 'apikey:test',
    description: 'Test API key authentication with the API gateway',
    usage: 'bun apikey:test',
    details: 'Sends a test request to the API gateway endpoint with the global API key to verify authentication works.'
  },
  {
    name: 'apikey:test:grpc',
    description: 'Test API key authentication for gRPC service-to-service calls',
    usage: 'bun apikey:test:grpc',
    details: 'Tests that API keys are correctly passed between services in gRPC communication.'
  },
  {
    name: 'apikey:test:combined',
    description: 'Test both JWT and API key authentication',
    usage: 'bun apikey:test:combined',
    details: 'Tests the CombinedAuthGuard that supports both API key and JWT token authentication methods.'
  },
  {
    name: 'apikey:diagnostic',
    description: 'Run a diagnostic tool to troubleshoot API key authentication issues',
    usage: 'bun apikey:diagnostic',
    details: 'Performs a comprehensive check of your API key configuration, salt values, database entries, and tests authentication.'
  }
];

function printTitle() {
  console.log('\n');
  console.log(`${colors.bright}${colors.fg.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.fg.cyan}        Bitsacco API Key Management Tools          ${colors.reset}`);
  console.log(`${colors.bright}${colors.fg.cyan}====================================================${colors.reset}`);
  console.log('\n');
}

function printOverview() {
  console.log(`${colors.bright}OVERVIEW:${colors.reset}`);
  console.log('Bitsacco uses API keys for service-to-service authentication and client access.');
  console.log('These commands help you generate, manage, and test API keys in the system.');
  console.log('For detailed information about API key authentication, see: docs/api-key-authentication.md');
  console.log('\n');
}

function printCommands() {
  console.log(`${colors.bright}AVAILABLE COMMANDS:${colors.reset}`);
  console.log('\n');
  
  commands.forEach(cmd => {
    console.log(`  ${colors.bright}${colors.fg.green}${cmd.name}${colors.reset}`);
    console.log(`  ${colors.dim}${cmd.description}${colors.reset}`);
    console.log(`  Usage: ${colors.fg.yellow}${cmd.usage}${colors.reset}`);
    console.log(`  ${cmd.details}`);
    console.log('\n');
  });
}

function printUsageExamples() {
  console.log(`${colors.bright}COMMON WORKFLOWS:${colors.reset}\n`);
  
  console.log(`${colors.fg.cyan}1. Setting up a development environment:${colors.reset}`);
  console.log('   bun apikey:generate      # Generate a global API key');
  console.log('   bun apikey:test          # Test the key works with the API gateway');
  console.log('\n');
  
  console.log(`${colors.fg.cyan}2. Managing API keys for a production environment:${colors.reset}`);
  console.log('   bun apikey:create        # Create specific service keys with limited permissions');
  console.log('   bun apikey:list          # View all active keys');
  console.log('   bun apikey:rotate        # Rotate a service key when needed');
  console.log('   bun apikey:revoke        # Revoke keys that are no longer needed');
  console.log('\n');

  console.log(`${colors.fg.cyan}3. Troubleshooting authentication issues:${colors.reset}`);
  console.log('   bun apikey:diagnostic    # Run comprehensive diagnostics on API key config');
  console.log('   bun apikey:test          # Test authentication with API gateway');
  console.log('   bun apikey:generate      # Regenerate a key if needed');
  console.log('\n');
}

function printFooter() {
  console.log(`${colors.bright}${colors.fg.cyan}====================================================${colors.reset}`);
  console.log(`${colors.dim}For more information, refer to the documentation in docs/api-key-authentication.md${colors.reset}`);
  console.log('\n');
}

// Main function
function displayHelp() {
  printTitle();
  printOverview();
  printCommands();
  printUsageExamples();
  printFooter();
}

// Run the help display
displayHelp();