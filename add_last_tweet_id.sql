-- Add last_tweet_id column to watchlist table for deduplication
-- This prevents duplicate notifications for the same tweet

ALTER TABLE watchlist 
ADD COLUMN IF NOT EXISTS last_tweet_id TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'watchlist';
