-- ==============================================================================
-- NEXUS: Daily Planner & Personal Activity History
-- Supabase PostgreSQL Schema Definition
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Clean existing tables if re-running (optional, safe creation)
-- DROP TABLE IF EXISTS settings CASCADE;
-- DROP TABLE IF EXISTS daily_records CASCADE;
-- DROP TABLE IF EXISTS tasks CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;

-- ==============================================================================
-- 3. CATEGORIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Seed default categories
INSERT INTO categories (name) VALUES
    ('Study'),
    ('Coding'),
    ('College'),
    ('Project'),
    ('Personal'),
    ('Other')
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- 4. TASKS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    planned_date DATE NOT NULL,
    original_planned_date DATE, -- Keeps permanent record of first planned date when moved
    start_time TIME,
    end_time TIME,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    category TEXT NOT NULL DEFAULT 'Personal',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Create recommended performance indexes
CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON tasks (planned_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks (category);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks (completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);

-- ==============================================================================
-- 5. DAILY RECORDS TABLE ("What I Did Today" & Daily Notes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS daily_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_date DATE NOT NULL UNIQUE,
    what_i_did TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Index on record_date for fast calendar & history queries
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records (record_date);

-- ==============================================================================
-- 6. SETTINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme TEXT DEFAULT 'cyberpunk',
    animations_enabled BOOLEAN DEFAULT true,
    sound_enabled BOOLEAN DEFAULT true,
    effects_3d_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- ==============================================================================
-- 7. UPDATED_AT TRIGGER FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_daily_records_updated_at ON daily_records;
CREATE TRIGGER trg_daily_records_updated_at
    BEFORE UPDATE ON daily_records
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Anonymous public access policies for single-user personal setup
-- Allows frontend client using anon key to perform CRUD operations
DROP POLICY IF EXISTS "Anon CRUD Categories" ON categories;
CREATE POLICY "Anon CRUD Categories" ON categories
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anon CRUD Tasks" ON tasks;
CREATE POLICY "Anon CRUD Tasks" ON tasks
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anon CRUD Daily Records" ON daily_records;
CREATE POLICY "Anon CRUD Daily Records" ON daily_records
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anon CRUD Settings" ON settings;
CREATE POLICY "Anon CRUD Settings" ON settings
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- Note for future multi-user auth upgrade:
-- When ready for Supabase Auth, add `user_id UUID REFERENCES auth.users(id)` column
-- to tasks, daily_records, categories, and settings, and replace the above policies with:
-- USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
-- ==============================================================================


