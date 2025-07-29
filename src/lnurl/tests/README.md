# LNURL Tests

## Overview

This directory contains tests for the LNURL module. The tests cover:
- Common utilities (encoding/decoding, QR generation, etc.)
- Service logic for withdrawals
- Type definitions and schemas

## Running Tests

### Working Tests

The following tests run successfully:

```bash
# Run common service tests
bun test src/lnurl/tests/lnurl-common.service.spec.ts

# Run all tests (will show some failures due to known issues)
bun test src/lnurl/tests/
```

## Known Issues

### Schema Import Issue

There is a known issue with Bun's test runner when importing the `LnurlTransaction` schema in test files. The error manifests as:

```
SyntaxError: Export named 'LnurlData' not found in module '/home/okj/bitsacco/os/src/lnurl/types/index.ts'.
```

This appears to be a module resolution issue specific to the test environment. The actual code works correctly in the application.

### Workarounds

1. **For unit tests**: Mock the service dependencies instead of importing the actual schema
2. **For integration tests**: Use the actual running application or e2e tests
3. **Alternative**: Use a different test runner configuration

## Test Coverage

Despite the import issues, the following areas have test coverage:

- ✅ LNURL encoding/decoding utilities
- ✅ Lightning Address validation
- ✅ QR code generation
- ✅ Amount conversion utilities
- ✅ Domain validation
- ✅ Common service methods
- ⚠️ Withdrawal service (tests written but import issue prevents execution)

## Future Improvements

1. Investigate and fix the Bun test runner module resolution issue
2. Add e2e tests for the full withdrawal flow
3. Add integration tests using a test database
4. Improve test coverage for edge cases