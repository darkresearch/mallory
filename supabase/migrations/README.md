# Supabase Database Migrations

This directory contains database migration scripts for the Mallory application's Supabase database.

## Overview

The migration files in this directory set up the complete database schema including:
- **Users table**: User profiles with onboarding status and preferences
- **Conversations table**: Chat conversations between users and AI
- **Messages table**: Individual messages within conversations
- **Row Level Security (RLS)**: Policies ensuring users can only access their own data
- **Triggers**: Automatic timestamp updates and real-time broadcasting
- **Functions**: Helper functions for querying conversations and messages
- **Indexes**: Performance optimizations for common queries

## Migration File

- `20250101000000_initial_schema.sql` - Initial database schema setup

## Installation

### Prerequisites

1. **Supabase Account**: You need access to your Supabase project
2. **Database Access**: You need the database connection string or access to the Supabase dashboard
3. **SQL Editor Access**: Access to run SQL queries in Supabase

### Method 1: Using Supabase Dashboard (Recommended)

1. **Navigate to SQL Editor**:
   - Go to your Supabase project dashboard
   - Click on "SQL Editor" in the left sidebar

2. **Run the Migration**:
   - Click "New Query"
   - Copy the entire contents of `20250101000000_initial_schema.sql`
   - Paste it into the SQL editor
   - Click "Run" or press `Ctrl+Enter` (or `Cmd+Enter` on Mac)

3. **Verify Success**:
   - Check for any errors in the output
   - Verify tables were created by checking the "Table Editor" section
   - You should see `users`, `conversations`, and `messages` tables

### Method 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Method 3: Using psql (PostgreSQL Client)

If you have direct database access:

```bash
# Set your connection string
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the migration
psql $DATABASE_URL -f supabase/migrations/20250101000000_initial_schema.sql
```

## Idempotency

**Important**: This migration is **idempotent**, meaning it can be run multiple times safely. It uses:
- `CREATE TABLE IF NOT EXISTS` for tables
- `DROP TRIGGER IF EXISTS` before creating triggers
- `DROP POLICY IF EXISTS` before creating policies
- `ADD COLUMN IF NOT EXISTS` for adding columns
- Conditional checks for publication membership

You can re-run this migration without errors, which is useful for:
- Updating existing databases
- Recovering from partial failures
- Testing in different environments

## What Gets Created

### Tables

1. **`users`**
   - `id` (UUID, Primary Key, references `auth.users`)
   - `has_completed_onboarding` (BOOLEAN)
   - `instant_buy_amount` (NUMERIC)
   - `instayield_enabled` (BOOLEAN)
   - `created_at`, `updated_at` (timestamps)

2. **`conversations`**
   - `id` (UUID, Primary Key)
   - `user_id` (UUID, references `auth.users`)
   - `title` (TEXT)
   - `token_ca` (TEXT)
   - `metadata` (JSONB)
   - `created_at`, `updated_at` (timestamps)

3. **`messages`**
   - `id` (UUID, Primary Key)
   - `conversation_id` (UUID, references `conversations`)
   - `role` (TEXT, constrained to 'user' or 'assistant')
   - `content` (TEXT)
   - `metadata` (JSONB)
   - `is_liked`, `is_disliked` (BOOLEAN)
   - `created_at`, `updated_at` (timestamps)

### Security

- **Row Level Security (RLS)** enabled on all tables
- **Policies** ensure users can only access their own data
- **Realtime policies** restrict broadcast subscriptions to user-specific channels

### Functions

- `get_conversation_with_messages(conv_id)` - Get full conversation with all messages
- `get_user_conversations(user_id)` - Get all conversations for a user with metadata

### Triggers

- Auto-update `updated_at` timestamps on table updates
- Update conversation timestamp when messages change
- Broadcast changes for real-time updates
- Auto-create user profile when auth user is created

## Verification

After running the migration, verify everything is set up correctly:

1. **Check Tables**:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('users', 'conversations', 'messages');
   ```

2. **Check Policies**:
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
   AND tablename IN ('users', 'conversations', 'messages');
   ```

3. **Check Triggers**:
   ```sql
   SELECT trigger_name, event_object_table 
   FROM information_schema.triggers 
   WHERE trigger_schema = 'public';
   ```

## Troubleshooting

### Error: "relation already exists"
- This is normal if you're re-running the migration
- The migration is idempotent and will skip existing objects

### Error: "permission denied"
- Ensure you're using a database user with sufficient privileges
- In Supabase dashboard, you should have admin access by default

### Error: "extension uuid-ossp does not exist"
- This extension should be available in Supabase by default
- If not, contact Supabase support

### Real-time not working
- Verify tables are added to `supabase_realtime` publication
- Check that Realtime is enabled in your Supabase project settings
- Verify the broadcast policies are correctly set

## Next Steps

After running the migration:

1. **Test the schema**: Create a test user and verify RLS policies work
2. **Set up environment variables**: Ensure your app has the correct Supabase credentials
3. **Test real-time**: Verify that real-time subscriptions work correctly
4. **Monitor**: Check Supabase logs for any issues

## Support

If you encounter issues:
1. Check the Supabase dashboard logs
2. Verify your database connection
3. Ensure all required extensions are available
4. Review the error messages for specific guidance

