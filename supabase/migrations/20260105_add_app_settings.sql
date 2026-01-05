-- ============================================
-- APP SETTINGS / FEATURE FLAGS TABLE
-- ============================================
-- Stores application-wide settings that can be toggled by admins
-- Used for features like reCAPTCHA, maintenance mode, etc.

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
CREATE INDEX IF NOT EXISTS idx_app_settings_category ON app_settings(category);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read settings (needed for client-side feature checks)
CREATE POLICY "app_settings_select_policy" ON app_settings
    FOR SELECT TO authenticated, anon
    USING (true);

-- Only site_admin can update settings
CREATE POLICY "app_settings_update_policy" ON app_settings
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'site_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'site_admin'
        )
    );

-- Only site_admin can insert new settings
CREATE POLICY "app_settings_insert_policy" ON app_settings
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'site_admin'
        )
    );

-- Trigger to update updated_at
CREATE OR REPLACE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DEFAULT SETTINGS
-- ============================================

-- reCAPTCHA Settings
INSERT INTO app_settings (key, value, is_enabled, description, category)
VALUES (
    'recaptcha',
    '{
        "score_threshold": 0.5,
        "actions": ["login", "register", "forgot_password", "feedback"],
        "bypass_for_authenticated": false
    }'::jsonb,
    false,  -- Disabled by default, admin must enable
    'Google reCAPTCHA v3 protection for public forms. Requires RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY environment variables.',
    'security'
)
ON CONFLICT (key) DO NOTHING;

-- Maintenance Mode (bonus feature)
INSERT INTO app_settings (key, value, is_enabled, description, category)
VALUES (
    'maintenance_mode',
    '{
        "message": "We are performing scheduled maintenance. Please check back soon.",
        "allowed_ips": [],
        "bypass_for_admins": true
    }'::jsonb,
    false,
    'When enabled, shows maintenance page to all non-admin users.',
    'general'
)
ON CONFLICT (key) DO NOTHING;

-- Feature: Email Notifications
INSERT INTO app_settings (key, value, is_enabled, description, category)
VALUES (
    'email_notifications',
    '{
        "send_expense_alerts": true,
        "send_settlement_reminders": true,
        "send_weekly_digest": false
    }'::jsonb,
    true,
    'Control email notification features globally.',
    'notifications'
)
ON CONFLICT (key) DO NOTHING;

-- Comment for documentation
COMMENT ON TABLE app_settings IS 'Application-wide settings and feature flags. Managed by site admins.';
COMMENT ON COLUMN app_settings.key IS 'Unique identifier for the setting (e.g., recaptcha, maintenance_mode)';
COMMENT ON COLUMN app_settings.value IS 'JSON configuration for the setting';
COMMENT ON COLUMN app_settings.is_enabled IS 'Master toggle for the feature';
COMMENT ON COLUMN app_settings.category IS 'Grouping category: security, general, notifications, etc.';

