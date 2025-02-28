# LNURL Withdrawal Documentation

## Overview

LNURL is a protocol for interacting with Lightning wallets using QR codes and links. This document describes the implementation of LNURL Withdrawal (LNURL-withdraw) in the Bitsacco system, which allows users to withdraw funds using a Lightning wallet that supports LNURL.

## Flow

1. **User Initiates Withdrawal**: User selects "Withdraw via LNURL" in the Bitsacco app.

2. **Generate LNURL**: The system generates an LNURL withdraw request with:
   - A unique `k1` value to identify the request
   - Maximum and minimum withdrawal amounts
   - A description
   - An expiry time

3. **Display QR Code**: A QR code containing the encoded LNURL is displayed to the user.

4. **User Scans QR**: The user scans the QR code with their Lightning wallet.

5. **Wallet Callback**: The user's wallet calls the Bitsacco callback URL with:
   - The `k1` parameter to identify the withdrawal request
   - A bolt11 payment request (`pr` parameter)

6. **Process Withdrawal**: Bitsacco processes the withdrawal by:
   - Validating the withdrawal request
   - Checking if the transaction has already been processed
   - Paying the invoice via Fedimint
   - Updating the transaction status

7. **Response**: The system returns a standard LNURL response:
   - `status: "OK"` on success
   - `status: "ERROR", reason: "..."` on failure

## Configuration Requirements

The following environment variables must be configured:

- `LNURL_CALLBACK`: The base URL that will handle the callback (e.g., `https://api.bitsacco.com/v1/solowallet/lnurl`)

## API Endpoints

### 1. Withdraw Funds (Authenticated)

```
POST /solowallet/withdraw
```

Request body:
```json
{
  "user_id": "user-123",
  "amountFiat": 1000,
  "reference": "Withdraw via LNURL",
  "lnurl_request": true
}
```

Response:
```json
{
  "tx_id": "tx-123",
  "ledger": {
    "transactions": [{
      "id": "tx-123",
      "status": "PENDING",
      "lightning": {
        "lnurl_withdraw_point": {
          "lnurl": "LNURL1...",
          "k1": "abcdef123456...",
          "expires_at": 1677777777
        }
      }
    }]
  }
}
```

### 2. LNURL Callback (Public)

```
GET /solowallet/lnurl?k1=abcdef123456...&pr=lnbc...
```

Response on success:
```json
{
  "status": "OK"
}
```

Response on error:
```json
{
  "status": "ERROR",
  "reason": "Withdrawal request expired"
}
```

## Error Handling

- **Expired Requests**: Requests expire after the configured expiry time (default 1 hour)
- **Invalid K1**: If the k1 doesn't match any pending transaction, an error is returned
- **Already Processed**: If the transaction has already been processed, an error is returned
- **Invoice Issues**: If the invoice is invalid or has issues, an error is returned

## Testing

To test the LNURL withdrawal flow, you need:

1. A running Fedimint instance
2. A Lightning wallet that supports LNURL-withdraw (e.g., Phoenix, Blue Wallet)

Test flows:
1. Complete flow - successful withdrawal
2. Expired withdrawal request
3. Invalid invoice
4. Attempt to process same withdrawal twice

## Debugging

When troubleshooting LNURL issues, check:

1. Logs in both API and solowallet services
2. Transaction records in the database
3. Fedimint status for the operation IDs
4. URL length (should be under 1000 characters ideally)
5. Proper bech32 encoding of the LNURL

## LNURL Specification Reference

For more details on the LNURL protocol, refer to:
https://github.com/lnurl/luds/blob/luds/03.md
