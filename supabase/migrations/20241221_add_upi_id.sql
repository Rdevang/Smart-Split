-- Add UPI ID field to profiles for payments
-- ============================================
-- UPI IDs are stored encrypted using AES-256-GCM
-- Format: enc:v1:<iv>:<authTag>:<ciphertext> (all base64 encoded)

-- Add upi_id column to profiles table
-- Using TEXT to accommodate encrypted data which is larger than plaintext
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Note: Index removed - encrypted values cannot be meaningfully indexed for search
-- Lookups will be by user ID (primary key), then decrypt in application layer

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.upi_id IS 'Encrypted UPI ID for receiving payments (stored as AES-256-GCM encrypted text)';

