# Supabase Database Setup

This guide will help you set up the Supabase database for local development.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Supabase CLI installed (`npm install -g supabase` or `brew install supabase/tap/supabase`)

## Quick Setup

### Option 1: Using Supabase SQL Editor (Recommended for Beginners)

1. Create a new Supabase project at https://supabase.com/dashboard
2. Go to the SQL Editor in your Supabase dashboard
3. Copy the contents of `supabase/migrations/20250101000000_initial_schema.sql`
4. Paste it into the SQL Editor and click "Run"
5. Your database is now set up!

### Option 2: Using Supabase CLI

1. Create a new Supabase project at https://supabase.com/dashboard

2. Link your local project to Supabase:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Push the migration to your Supabase project:
   ```bash
   supabase db push
   ```

## Database Schema

The migration creates the following tables:

### `users`
- Stores user profiles and preferences
- Linked to Supabase Auth users
- Auto-created when a user signs up

### `conversations`
- Stores chat conversations between users and AI
- Each conversation has a title and token contract address
- Supports metadata for additional features

### `messages`
- Individual messages within conversations
- Supports roles: `user`, `assistant`, `system`, `tool_use`, `tool_result`
- Includes rich metadata for AI tool usage

## Security

All tables have Row Level Security (RLS) enabled:
- Users can only access their own data
- Realtime subscriptions are enabled for live updates
- Automatic triggers handle user creation and updates

## Helper Functions

The migration includes helpful functions:

- `get_conversation_with_messages(conv_id)` - Get a conversation with all messages
- `get_user_conversations(user_id)` - Get all conversations for a user with metadata

## Troubleshooting

If you encounter errors:

1. Make sure you have the correct Supabase project URL and anon key in your `.env` files
2. Verify your Supabase project is active and not paused
3. Check that you have permission to create tables in the SQL Editor
4. If using CLI, ensure you're logged in: `supabase login`

## Need Help?

- Check the main README.md for API key setup
- See docs/mallory_readme.md for project architecture
- Open an issue on GitHub if you're stuck
