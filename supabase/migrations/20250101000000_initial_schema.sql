-- Mallory Supabase Database Setup Script

-- Create extension for UUID generation (needed for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table for authentication
-- Note: email, display_name, profile_picture come from auth.users metadata, not stored here
CREATE TABLE IF NOT EXISTS users (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    has_completed_onboarding BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    title TEXT NOT NULL,
    token_ca TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_liked BOOLEAN DEFAULT false,
    is_disliked BOOLEAN DEFAULT false,
    CONSTRAINT messages_role_check CHECK (role = ANY (ARRAY['user', 'assistant']))
);

COMMENT ON COLUMN messages.is_liked IS 'User indicated this was a good response';
COMMENT ON COLUMN messages.is_disliked IS 'User indicated this was a poor response';

-- Enable Row Level Security (RLS) for tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access (with idempotency via DROP IF EXISTS)
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
CREATE POLICY "Users can insert their own conversations" ON conversations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;
CREATE POLICY "Users can delete their own conversations" ON conversations
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Use EXISTS for better performance than IN subquery
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND conversations.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;
CREATE POLICY "Users can insert messages in their conversations" ON messages
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND conversations.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can update messages in their conversations" ON messages;
CREATE POLICY "Users can update messages in their conversations" ON messages
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND conversations.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON messages;
CREATE POLICY "Users can delete messages in their conversations" ON messages
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND conversations.user_id = auth.uid()
    ));

-- Create indexes for better performance
-- Compound index covers both user_id lookups and user_id + updated_at ordering
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
-- Compound index for loading messages in chronological order
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);

-- Insert a trigger to automatically update updated_at timestamps
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at timestamp
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update conversation timestamp when messages change
CREATE OR REPLACE FUNCTION update_conversation_on_message_change()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW() 
    WHERE id = COALESCE(NEW.conversation_id, OLD.conversation_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_conversation_on_message_change() IS 'Updates conversation timestamp when messages are added/updated/deleted';

CREATE TRIGGER update_conversation_on_message_change
    AFTER INSERT OR UPDATE OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message_change();

-- Function to broadcast conversation changes for real-time updates
CREATE OR REPLACE FUNCTION conversations_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Broadcast to user-specific channel for real-time updates
  PERFORM realtime.broadcast_changes(
    'conversations:user:' || COALESCE(NEW.user_id, OLD.user_id),
    TG_OP,                -- event (INSERT, UPDATE, DELETE)
    TG_OP,                -- operation 
    TG_TABLE_NAME,        -- table name
    TG_TABLE_SCHEMA,      -- schema name
    NEW,                  -- new record (null for DELETE)
    OLD                   -- old record (null for INSERT)
  );
  
  -- Log for debugging
  RAISE LOG 'Conversations broadcast sent: % for user % conversation %', 
    TG_OP, 
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.id, OLD.id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION conversations_changes() IS 'Broadcasts conversation changes to user-specific channels for real-time chat history updates';

-- Create trigger for conversations changes
DROP TRIGGER IF EXISTS handle_conversations_changes ON conversations;
CREATE TRIGGER handle_conversations_changes
    AFTER INSERT OR UPDATE OR DELETE ON conversations
    FOR EACH ROW EXECUTE FUNCTION conversations_changes();

COMMENT ON TRIGGER handle_conversations_changes ON conversations IS 'Triggers real-time broadcasts for conversation changes to keep chat history in sync';

-- Function to broadcast message changes for real-time updates
CREATE OR REPLACE FUNCTION messages_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  conversation_user_id UUID;
BEGIN
  -- Get the user_id from the conversation for targeted broadcasting
  SELECT user_id INTO conversation_user_id
  FROM conversations 
  WHERE id = COALESCE(NEW.conversation_id, OLD.conversation_id);
  
  -- Broadcast to user-specific channel
  PERFORM realtime.broadcast_changes(
    'messages:user:' || conversation_user_id,
    TG_OP,                -- event (INSERT, UPDATE, DELETE)
    TG_OP,                -- operation 
    TG_TABLE_NAME,        -- table name
    TG_TABLE_SCHEMA,      -- schema name
    NEW,                  -- new record (null for DELETE)
    OLD                   -- old record (null for INSERT)
  );
  
  -- Log for debugging
  RAISE LOG 'Messages broadcast sent: % for conversation % user %', 
    TG_OP, 
    COALESCE(NEW.conversation_id, OLD.conversation_id),
    conversation_user_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION messages_changes() IS 'Broadcasts message changes to user-specific channels for real-time chat updates';

-- Create trigger for message changes
DROP TRIGGER IF EXISTS handle_messages_changes ON messages;
CREATE TRIGGER handle_messages_changes
    AFTER INSERT OR UPDATE OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION messages_changes();

COMMENT ON TRIGGER handle_messages_changes ON messages IS 'Triggers real-time broadcasts for message changes to keep chat in sync';

-- Create a function to automatically create a user record when a new auth user is created
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, has_completed_onboarding)
    VALUES (NEW.id, false)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_user_profile() IS 'Auto-creates user profile when auth.users record is created';

-- Create trigger for new users
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Enable the Realtime subscription for the tables
-- Add tables to realtime publication for websocket subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Security: Restrict realtime broadcast subscriptions to user-specific channels only
-- This prevents users from hijacking other users' broadcast channels
-- Drop existing permissive policy if it exists
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;

-- Create restrictive policy that enforces channel-level authorization
CREATE POLICY "Users can only receive their own broadcasts" 
ON realtime.messages
FOR SELECT 
TO authenticated
USING (
  -- Allow if channel name (topic) contains the authenticated user's ID
  -- Format: conversations:user:{userId} or messages:user:{userId}
  topic LIKE '%:user:' || (auth.uid())::text || '%'
  OR
  -- Allow public/shared channels that don't contain :user: pattern
  topic NOT LIKE '%:user:%'
);

COMMENT ON POLICY "Users can only receive their own broadcasts" ON realtime.messages IS 'Prevents users from subscribing to other users'' private broadcast channels';

-- Create a function to get conversation history with user info
CREATE OR REPLACE FUNCTION get_conversation_with_messages(conv_id UUID)
RETURNS TABLE(
    conversation_id UUID,
    user_id UUID,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    message_id UUID,
    role TEXT,
    content TEXT,
    message_created_at TIMESTAMP WITH TIME ZONE,
    message_metadata JSONB
)
LANGUAGE SQL
AS $$
    SELECT
        c.id as conversation_id,
        c.user_id,
        c.title,
        c.created_at,
        c.updated_at,
        m.id as message_id,
        m.role,
        m.content,
        m.created_at as message_created_at,
        m.metadata as message_metadata
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.id = conv_id
    ORDER BY m.created_at ASC;
$$;

-- Create a function to get recent conversations for a user
CREATE OR REPLACE FUNCTION get_user_conversations(user_id_param UUID)
RETURNS TABLE(
    id UUID,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_message_content TEXT,
    last_message_created_at TIMESTAMP WITH TIME ZONE,
    message_count BIGINT
)
LANGUAGE SQL
AS $$
    SELECT
        c.id,
        c.title,
        c.created_at,
        c.updated_at,
        (SELECT content FROM messages
         WHERE conversation_id = c.id
         ORDER BY created_at DESC LIMIT 1) as last_message_content,
        (SELECT created_at FROM messages
         WHERE conversation_id = c.id
         ORDER BY created_at DESC LIMIT 1) as last_message_created_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    WHERE c.user_id = user_id_param
    ORDER BY c.updated_at DESC;
$$;

-- Add comments to describe the tables
COMMENT ON TABLE users IS 'User profiles - minimal table for Mallory-specific data';
COMMENT ON COLUMN users.id IS 'Primary key - matches the auth.users.id';
COMMENT ON COLUMN users.has_completed_onboarding IS 'Whether user has completed onboarding flow';

COMMENT ON TABLE conversations IS 'Chat conversations between users and AI';
COMMENT ON COLUMN conversations.token_ca IS 'Token contract address (default is all zeros for global conversations)';
COMMENT ON COLUMN conversations.metadata IS 'Additional conversation metadata (e.g., onboarding status)';

COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON COLUMN messages.role IS 'Message role: user, assistant, system, tool_use, tool_result';
COMMENT ON COLUMN messages.content IS 'Text content of the message (for display purposes)';
COMMENT ON COLUMN messages.metadata IS 'Full message data including rich content and tool usage';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE messages TO authenticated;

-- Enable Row Level Security on users table too (if not already enabled by auth)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy for users table (users can only see their own data) with idempotency
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can create own profile" ON users;
CREATE POLICY "Users can create own profile" ON users
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);
