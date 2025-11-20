# Gas Abstraction API Documentation

This document describes the API endpoints for x402 Gas Abstraction integration in Mallory.

## Base URL

All endpoints are prefixed with `/api/gas-abstraction`.

## Authentication

All endpoints require user authentication via Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Additionally, some endpoints require Grid session data in the request body for wallet operations.

## Endpoints

### POST /api/gas-abstraction/balance

Returns the user's gateway balance and transaction history.

**Note:** This endpoint uses POST instead of GET because Grid session data needs to be sent in the request body.

#### Request Body

```json
{
  "gridSessionSecrets": {
    // Grid session secrets object
  },
  "gridSession": {
    "address": "string (base58 public key)",
    "authentication": {
      // Grid authentication object
    }
  }
}
```

#### Response (200 OK)

```json
{
  "wallet": "string (base58 public key)",
  "balanceBaseUnits": 1000000,
  "topups": [
    {
      "paymentId": "string",
      "txSignature": "string (Solana transaction signature)",
      "amountBaseUnits": 5000000,
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "usages": [
    {
      "txSignature": "string (Solana transaction signature)",
      "amountBaseUnits": 5000,
      "status": "pending" | "settled" | "failed",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "settled_at": "2024-01-01T00:01:00.000Z"
    }
  ]
}
```

#### Response Fields

- `wallet`: User's wallet address (base58 public key)
- `balanceBaseUnits`: Current balance in USDC base units (6 decimals: 1,000,000 = 1 USDC)
- `topups`: Array of top-up records
  - `paymentId`: Payment identifier (same as txSignature)
  - `txSignature`: Solana transaction signature for the top-up payment
  - `amountBaseUnits`: Amount credited in base units
  - `timestamp`: ISO 8601 timestamp
- `usages`: Array of sponsored transaction records
  - `txSignature`: Solana transaction signature
  - `amountBaseUnits`: Amount debited in base units
  - `status`: Transaction status (`pending`, `settled`, or `failed`)
  - `timestamp`: ISO 8601 timestamp when transaction was sponsored
  - `settled_at`: ISO 8601 timestamp when transaction was settled (optional)

#### Error Responses

**400 Bad Request**
```json
{
  "error": "Grid session required",
  "message": "gridSessionSecrets and gridSession must be provided in request body"
}
```

**401 Unauthorized**
```json
{
  "error": "Authentication failed",
  "message": "Invalid or expired token"
}
```

**503 Service Unavailable**
```json
{
  "error": "Gas abstraction service not configured",
  "message": "GAS_GATEWAY_URL and SOLANA_RPC_URL must be set in environment"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to fetch balance",
  "message": "Error details"
}
```

#### Example Request

```bash
curl -X POST https://api.mallory.app/api/gas-abstraction/balance \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "gridSessionSecrets": {...},
    "gridSession": {
      "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "authentication": {...}
    }
  }'
```

---

### GET /api/gas-abstraction/topup/requirements

Returns payment requirements for top-up. This endpoint does not require gateway authentication, but user authentication is required.

#### Request

No request body required.

#### Response (200 OK)

```json
{
  "x402Version": 1,
  "resource": "string",
  "accepts": [
    {
      "scheme": "solana",
      "network": "solana-mainnet-beta",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    }
  ],
  "scheme": "solana",
  "network": "solana-mainnet-beta",
  "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "maxAmountRequired": 100000000,
  "payTo": "string (base58 address)",
  "description": "Gas abstraction top-up"
}
```

#### Response Fields

- `x402Version`: x402 protocol version (currently 1)
- `resource`: Resource identifier
- `accepts`: Array of accepted payment schemes
  - `scheme`: Payment scheme (e.g., "solana")
  - `network`: Network identifier (e.g., "solana-mainnet-beta")
  - `asset`: Asset mint address (USDC mint)
- `scheme`: Primary payment scheme
- `network`: Network identifier
- `asset`: Asset mint address
- `maxAmountRequired`: Maximum top-up amount in base units
- `payTo`: Gateway address to send USDC payment
- `description`: Payment description

#### Error Responses

**400 Bad Request** - Network or asset mismatch
```json
{
  "error": "Network or asset mismatch",
  "details": "Gateway requirements do not match Mallory configuration",
  "gatewayNetwork": "solana-mainnet-beta",
  "expectedNetwork": "solana-mainnet-beta",
  "gatewayAsset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "expectedAsset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
}
```

**503 Service Unavailable**
```json
{
  "error": "Gas abstraction service not configured",
  "message": "GAS_GATEWAY_URL and SOLANA_RPC_URL must be set in environment"
}
```

#### Example Request

```bash
curl -X GET https://api.mallory.app/api/gas-abstraction/topup/requirements \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/gas-abstraction/topup

Submit USDC payment to credit balance.

#### Request Body

Two formats are supported:

**Format 1: Direct payment payload (legacy)**
```json
{
  "payment": "base64-encoded x402 payment payload"
}
```

**Format 2: Transaction data (recommended)**
```json
{
  "transaction": "base64-encoded unsigned VersionedTransaction",
  "publicKey": "string (base58 public key)",
  "amountBaseUnits": 5000000,
  "gridSessionSecrets": {
    // Grid session secrets object
  },
  "gridSession": {
    "address": "string (base58 public key)",
    "authentication": {
      // Grid authentication object
    }
  }
}
```

#### Response (200 OK)

```json
{
  "wallet": "string (base58 public key)",
  "amountBaseUnits": 5000000,
  "txSignature": "string (Solana transaction signature)",
  "paymentId": "string (same as txSignature)"
}
```

#### Response Fields

- `wallet`: User's wallet address
- `amountBaseUnits`: Amount credited in base units
- `txSignature`: Solana transaction signature for the top-up payment
- `paymentId`: Payment identifier (same as txSignature)

#### Error Responses

**400 Bad Request** - Invalid payment or transaction data
```json
{
  "error": "Payment payload or transaction data required",
  "message": "Provide either 'payment' (base64 x402 payload) or 'transaction', 'publicKey', 'amountBaseUnits', 'gridSessionSecrets', and 'gridSession'"
}
```

**402 Payment Required**
```json
{
  "error": "Payment missing or invalid",
  "message": "x402 payment verification failed"
}
```

**503 Service Unavailable**
```json
{
  "error": "Gas abstraction service not configured",
  "message": "GAS_GATEWAY_URL and SOLANA_RPC_URL must be set in environment"
}
```

#### Example Request

```bash
curl -X POST https://api.mallory.app/api/gas-abstraction/topup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": "base64-encoded-tx...",
    "publicKey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amountBaseUnits": 5000000,
    "gridSessionSecrets": {...},
    "gridSession": {...}
  }'
```

---

### POST /api/gas-abstraction/sponsor

Request transaction sponsorship. The gateway will pay transaction fees on behalf of the user.

#### Request Body

```json
{
  "transaction": "base64-encoded unsigned VersionedTransaction",
  "gridSessionSecrets": {
    // Grid session secrets object
  },
  "gridSession": {
    "address": "string (base58 public key)",
    "authentication": {
      // Grid authentication object
    }
  }
}
```

#### Response (200 OK)

```json
{
  "transaction": "base64-encoded sponsored VersionedTransaction",
  "billedBaseUnits": 5000,
  "fee": {
    "amount": 5000,
    "amount_decimal": "0.005",
    "currency": "USDC"
  }
}
```

#### Response Fields

- `transaction`: Base64-encoded sponsored VersionedTransaction ready for user signing
- `billedBaseUnits`: Amount debited from balance in base units
- `fee`: Optional fee breakdown
  - `amount`: Fee amount in base units
  - `amount_decimal`: Fee amount in USDC (6 decimals)
  - `currency`: Currency code (USDC)

#### Error Responses

**400 Bad Request** - Invalid transaction or old blockhash
```json
{
  "error": "Invalid transaction",
  "message": "Transaction format is invalid or blockhash is expired"
}
```

**400 Bad Request** - Prohibited instruction
```json
{
  "error": "Prohibited instruction",
  "message": "This operation is not supported by gas sponsorship"
}
```

**401 Unauthorized** - Authentication failed
```json
{
  "error": "Authentication failed",
  "message": "Invalid wallet signature. Please retry."
}
```

**402 Payment Required** - Insufficient balance
```json
{
  "error": "Insufficient balance",
  "message": "Not enough gas credits to sponsor transaction",
  "data": {
    "required": 10000,
    "requiredBaseUnits": 10000,
    "available": 5000,
    "availableBaseUnits": 5000
  }
}
```

**503 Service Unavailable**
```json
{
  "error": "Service temporarily unavailable",
  "message": "Gas gateway is currently unavailable. Please try again later."
}
```

#### Example Request

```bash
curl -X POST https://api.mallory.app/api/gas-abstraction/sponsor \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": "base64-encoded-unsigned-tx...",
    "gridSessionSecrets": {...},
    "gridSession": {...}
  }'
```

## Error Codes

### HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request data or transaction format
- `401 Unauthorized`: Authentication failed (invalid token or wallet signature)
- `402 Payment Required`: Insufficient balance or invalid payment
- `503 Service Unavailable`: Gateway service unavailable or not configured

### Error Handling

All error responses follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "data": {
    // Additional error data (optional)
  }
}
```

### Common Error Scenarios

1. **Old Blockhash (400)**: Transaction blockhash has expired. Client should fetch a fresh blockhash and rebuild the transaction.

2. **Insufficient Balance (402)**: User doesn't have enough USDC credits. Client should prompt user to top up.

3. **Prohibited Instruction (400)**: Transaction contains instructions that cannot be sponsored (e.g., closing accounts, certain program instructions).

4. **Service Unavailable (503)**: Gateway is temporarily down. Client should offer SOL fallback option.

## Authentication Headers

The backend automatically generates authentication headers for gateway requests using Ed25519 signatures. The authentication format is:

```
X-Wallet-Signature: <base58-encoded-signature>
X-Wallet-Address: <base58-public-key>
X-Nonce: <uuid-v4>
```

These headers are generated server-side and are not required in client requests to Mallory's API.

## Rate Limiting

Currently, no rate limiting is enforced. However, clients should implement reasonable retry logic:

- **Balance requests**: Retry once for transient network errors
- **Sponsorship requests**: Retry once for old blockhash errors (with fresh blockhash)
- **Top-up requests**: Do not retry automatically (user action required)

## Base Units Conversion

USDC uses 6 decimal places. To convert between base units and USDC:

- **Base units to USDC**: `baseUnits / 1,000,000`
- **USDC to base units**: `usdc * 1,000,000`

Example:
- `5,000,000` base units = `5.0` USDC
- `500` base units = `0.0005` USDC

## Transaction Format

All transactions must be Solana `VersionedTransaction` objects, serialized as base64 strings.

### Creating a VersionedTransaction

```typescript
import { 
  VersionedTransaction, 
  TransactionMessage,
  Connection 
} from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const { blockhash } = await connection.getLatestBlockhash();

const message = new TransactionMessage({
  payerKey: userPublicKey,
  recentBlockhash: blockhash,
  instructions: [
    // Your instructions here
  ]
}).compileToV0Message();

const transaction = new VersionedTransaction(message);
const serialized = Buffer.from(transaction.serialize()).toString('base64');
```

## Testing

See the integration tests in `apps/client/__tests__/integration/gas-abstraction-*.test.ts` for example usage of these endpoints.

## Support

For issues or questions:
- 📧 Email: hello@darkresearch.ai
- 🐛 Issues: [GitHub Issues](https://github.com/darkresearch/mallory/issues)

