-- Mallory Supabase Database Setup Script

-- Create extension for UUID generation (needed for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    profile_picture TEXT,
    instant_buy_amount DECIMAL DEFAULT 0,
    instayield_enabled BOOLEAN DEFAULT false,
    has_completed_onboarding BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    title TEXT NOT NULL DEFAULT 'mallory-global',
    token_ca TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL, -- 'user', 'assistant', 'system', 'tool_use', 'tool_result'
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Enable Row Level Security (RLS) for tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON conversations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON conversations
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT TO authenticated
    USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert messages in their conversations" ON messages
    FOR INSERT TO authenticated
    WITH CHECK (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can update messages in their conversations" ON messages
    FOR UPDATE TO authenticated
    USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete messages in their conversations" ON messages
    FOR DELETE TO authenticated
    USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

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

-- Insert trigger to notify about conversation changes (for real-time updates)
CREATE OR REPLACE FUNCTION handle_conversations_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify about conversation changes
  IF (TG_OP = 'INSERT') THEN
    -- Send notification when conversation is inserted
    PERFORM pg_notify('conversations_changes', json_build_object(
      'type', 'insert',
      'conversation_id', NEW.id,
      'user_id', NEW.user_id
    )::text);
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Send notification when conversation is updated
    PERFORM pg_notify('conversations_changes', json_build_object(
      'type', 'update',
      'conversation_id', NEW.id,
      'user_id', NEW.user_id,
      'updated_at', NEW.updated_at
    )::text);
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    -- Send notification when conversation is deleted
    PERFORM pg_notify('conversations_changes', json_build_object(
      'type', 'delete',
      'conversation_id', OLD.id,
      'user_id', OLD.user_id
    )::text);
    RETURN OLD;
  END IF;
  RETURN NULL; -- Result is ignored since this is an AFTER trigger
END;
$$ LANGUAGE plpgsql;

-- Create trigger for conversations changes
DROP TRIGGER IF EXISTS on_conversations_changes on conversations;
CREATE TRIGGER on_conversations_changes
    AFTER INSERT OR UPDATE OR DELETE ON conversations
    FOR EACH ROW EXECUTE FUNCTION handle_conversations_changes();

-- Create a function to automatically create a user record when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, profile_picture)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable the Realtime subscription for the tables
-- Note: With Supabase 2.0+, this is handled automatically when RLS is enabled
-- But explicitly granting access for authenticated users to listen
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT SELECT ON TABLE conversations TO authenticated;
GRANT SELECT ON TABLE messages TO authenticated;

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
COMMENT ON TABLE users IS 'User profiles and preferences';
COMMENT ON COLUMN users.id IS 'Primary key - matches the auth.users.id';
COMMENT ON COLUMN users.instant_buy_amount IS 'Amount for instant buy orders';
COMMENT ON COLUMN users.instayield_enabled IS 'Whether yield generation is enabled';
COMMENT ON COLUMN users.has_completed_onboarding IS 'Whether user has completed onboarding';

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

-- Policy for users table (users can only see their own data)
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);
