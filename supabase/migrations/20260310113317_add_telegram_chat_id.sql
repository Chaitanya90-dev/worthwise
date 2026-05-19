ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT UNIQUE;
