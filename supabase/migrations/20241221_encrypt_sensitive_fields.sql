-- Encryption for Sensitive Fields
-- ============================================
-- This migration updates columns to accommodate encrypted data
-- Encrypted format: enc:v1:<iv>:<authTag>:<ciphertext> (base64 encoded)

-- 1. Update phone column to TEXT (encrypted data is larger than plaintext)
-- Note: If phone was VARCHAR, we need to change it to TEXT
ALTER TABLE public.profiles 
ALTER COLUMN phone TYPE TEXT;

-- 2. UPI ID is already TEXT from previous migration

-- 3. Add comment documenting encrypted fields
COMMENT ON COLUMN public.profiles.phone IS 'Encrypted phone number (stored as AES-256-GCM encrypted text)';
COMMENT ON COLUMN public.profiles.upi_id IS 'Encrypted UPI ID for receiving payments (stored as AES-256-GCM encrypted text)';

-- Note: Existing unencrypted data will be encrypted on next update via application layer
-- The encryption utility handles both encrypted and plaintext values gracefully

