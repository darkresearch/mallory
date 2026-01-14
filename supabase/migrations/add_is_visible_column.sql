-- Add is_visible column to conversations table for soft deletion
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;

-- Create index for performance when filtering visible conversations
CREATE INDEX IF NOT EXISTS idx_conversations_is_visible ON conversations(is_visible);

-- Update any existing conversations to be visible
UPDATE conversations SET is_visible = true WHERE is_visible IS NULL;
