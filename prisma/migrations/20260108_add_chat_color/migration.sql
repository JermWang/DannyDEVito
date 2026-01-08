-- Add color column to ChatMessage table
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "color" TEXT;
