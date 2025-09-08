-- Supabase SQL: Create photos table for user-specific progress
CREATE TABLE IF NOT EXISTS photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    url text NOT NULL,
    "timestamp" timestamptz NOT NULL DEFAULT now(),
    analysis text,
    file_name text,
    file_size integer,
    -- Add more fields as needed
    created_at timestamptz DEFAULT now()
);

-- Add index for user_id column used in policies
CREATE INDEX IF NOT EXISTS photos_user_id_idx ON photos (user_id);

-- Enable Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own photos
DROP POLICY IF EXISTS "Users can view their own photos" ON photos;
CREATE POLICY "Users can view their own photos" ON photos
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own photos" ON photos;
CREATE POLICY "Users can insert their own photos" ON photos
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own photos" ON photos;
CREATE POLICY "Users can update their own photos" ON photos
    FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own photos" ON photos;
CREATE POLICY "Users can delete their own photos" ON photos
    FOR DELETE USING ((SELECT auth.uid()) = user_id);
