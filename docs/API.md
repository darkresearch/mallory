# Mallory Backend API Documentation

This document describes the backend API contract from the client's perspective. Mallory can connect to any backend that implements this API.

## Getting Backend Access

### Option 1: Hosted Backend (Recommended)

Contact Dark at hello@darkresearch.ai for access to a managed backend instance. Benefits include:

- Production-ready infrastructure
- Managed databases and services
- Regular updates and monitoring
- Enterprise support options

### Option 2: Self-Hosted

Implement your own backend following the specifications below. You'll need to:

- Set up API endpoints as documented
- Configure Supabase for data storage and real-time features
- Implement authentication flows
- Handle AI streaming responses

## Base Configuration

The API base URL is configured via the `EXPO_PUBLIC_BACKEND_API_URL` environment variable.

All API requests should include standard headers:
```
Content-Type: application/json
```

## Authentication

Mallory uses Supabase for authentication. The client handles:

- Google OAuth sign-in flow
- Session token management
- Token refresh

Your backend should:

- Validate Supabase session tokens
- Enforce Row Level Security (RLS) policies
- Return 401 for unauthorized requests

## API Endpoints

### Chat Endpoints

#### POST `/api/chat`

Stream AI chat responses using server-sent events (SSE).

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user" | "assistant" | "system",
      "content": "message text"
    }
  ],
  "conversationId": "uuid",
  "userId": "uuid"
}
```

**Response:**

Server-sent events stream with the following event types:

```
data: {"type": "text-delta", "textDelta": "..."}
data: {"type": "tool-call", "toolName": "...", "args": {...}}
data: {"type": "tool-result", "result": {...}}
data: {"type": "finish", "finishReason": "stop"}
```

**Status Codes:**
- 200: Success (SSE stream)
- 401: Unauthorized
- 500: Server error

### Conversation Endpoints

Conversations are managed directly through Supabase with Row Level Security. No dedicated API endpoints required.

**Database Schema (Supabase):**

```sql
-- conversations table
id: uuid (primary key)
user_id: uuid (foreign key to auth.users)
title: text
token_ca: text (for token-specific conversations, or global identifier)
created_at: timestamp
updated_at: timestamp
metadata: jsonb
```

### Message Endpoints

Messages are also managed through Supabase with real-time subscriptions.

**Database Schema (Supabase):**

```sql
-- messages table
id: uuid (primary key)
conversation_id: uuid (foreign key)
user_id: uuid (foreign key)
role: text ('user' | 'assistant' | 'system')
content: text
parts: jsonb (structured message content)
created_at: timestamp
```

### Wallet Endpoints

#### GET `/api/wallet/balance`

Get user's wallet balance.

**Query Parameters:**
- `userId`: User ID

**Response:**
```json
{
  "balance": number,
  "currency": "SOL" | "USDC",
  "address": "wallet-address"
}
```

#### POST `/api/wallet/grid/session`

Create or retrieve Grid session for wallet operations.

**Request Body:**
```json
{
  "userId": "uuid"
}
```

**Response:**
```json
{
  "sessionId": "grid-session-id",
  "status": "active" | "pending_verification"
}
```

## Supabase Configuration

### Required Tables

Your Supabase instance should have:

1. `conversations` - Chat conversations
2. `messages` - Individual chat messages
3. `users` - Extended user profile data

### Row Level Security (RLS)

Enable RLS on all tables with policies that:

- Allow users to read only their own data
- Allow users to create/update only their own data
- Prevent users from modifying other users' data

Example RLS policy:

```sql
CREATE POLICY "Users can view own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
ON conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Real-time Subscriptions

Enable real-time on the `messages` table to support live chat updates:

```sql
ALTER TABLE messages REPLICA IDENTITY FULL;
```

The client subscribes to message changes using:

```typescript
supabase
  .channel(`conversation:${conversationId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, handleMessageUpdate)
  .subscribe();
```

## AI Integration

The backend should integrate with an AI provider (e.g., Anthropic Claude, OpenAI) to:

1. Process chat messages
2. Generate streaming responses
3. Handle tool calls (web search, etc.)
4. Manage conversation context

The client expects streaming responses in the format described in the `/api/chat` endpoint.

## Security Considerations

### Authentication

- Always validate Supabase session tokens
- Implement proper session expiry
- Use HTTPS for all API calls

### Rate Limiting

Implement rate limiting on:

- Chat API endpoints (per user)
- Wallet operations (per user)
- Authentication attempts

### Data Privacy

- Never expose other users' conversations or messages
- Implement proper RLS policies
- Encrypt sensitive data at rest
- Use secure environment variables for API keys

## Error Handling

Standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid or missing auth)
- `403` - Forbidden (valid auth, insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

Error response format:

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

## Development & Testing

### Testing with Mock Backend

For development, you can create a minimal mock backend that:

1. Returns static responses for chat
2. Uses Supabase directly for data storage
3. Skips AI integration initially

### Local Development

When running locally:

1. Set `EXPO_PUBLIC_BACKEND_API_URL=http://localhost:3000` (Note: In dev mode, the app automatically uses localhost:3001)
2. Ensure CORS headers allow your development origin
3. Use Supabase local development or cloud project

## Support

For questions about the API:

- Self-hosted developers: See GitHub Issues
- Hosted customers: Contact support@darkresearch.ai

## Changelog

### v1.0.0 (Initial Release)

- Chat streaming endpoint
- Supabase-based conversation management
- Grid wallet integration
- Basic authentication flow

