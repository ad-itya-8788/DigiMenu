-- ============================================
-- Admin Session Migration Script
-- ============================================
-- Purpose: Modify sessions table to support both customer and admin sessions
-- Date: December 20, 2025
-- Security: Enables secure database-backed admin authentication
-- ============================================

-- Step 1: Make customer_id nullable (to allow admin sessions)
ALTER TABLE sessions ALTER COLUMN customer_id DROP NOT NULL;

-- Step 2: Add admin_id column
ALTER TABLE sessions ADD COLUMN admin_id INTEGER;

-- Step 3: Add foreign key constraint for admin_id
ALTER TABLE sessions ADD CONSTRAINT fk_sessions_admin 
    FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE;

-- Step 4: Add check constraint - either customer_id OR admin_id must be set (not both, not neither)
ALTER TABLE sessions ADD CONSTRAINT check_user_type 
    CHECK (
        (customer_id IS NOT NULL AND admin_id IS NULL) OR 
        (customer_id IS NULL AND admin_id IS NOT NULL)
    );

-- Step 5: Create index on admin_id for faster lookups
CREATE INDEX idx_sessions_admin_id ON sessions(admin_id);

-- Step 6: Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Step 7: Create composite index for admin session validation
CREATE INDEX idx_sessions_admin_validation ON sessions(admin_id, expires_at) WHERE admin_id IS NOT NULL;

-- ============================================
-- Verification Queries (Run after migration)
-- ============================================

-- Check table structure
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'sessions' 
-- ORDER BY ordinal_position;

-- Check constraints
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'sessions';

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'sessions';

-- ============================================
-- Rollback Script (Use only if needed)
-- ============================================

-- DROP INDEX IF EXISTS idx_sessions_admin_validation;
-- DROP INDEX IF EXISTS idx_sessions_admin_id;
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS check_user_type;
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS fk_sessions_admin;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS admin_id;
-- ALTER TABLE sessions ALTER COLUMN customer_id SET NOT NULL;

-- ============================================
-- Notes
-- ============================================
-- 1. This migration is backward compatible with existing customer sessions
-- 2. All existing customer sessions will continue to work
-- 3. Admin sessions will now be stored in the same table with admin_id
-- 4. The check constraint ensures data integrity (no orphan sessions)
-- 5. Indexes improve query performance for admin session lookups
-- 6. ON DELETE CASCADE ensures sessions are cleaned up when admin is deleted
