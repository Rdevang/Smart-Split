-- Add invite_code column to groups table for QR code joining
-- Each group has a unique invite code that can be shared via QR code or link

-- Add the invite_code column
ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_code VARCHAR(12) UNIQUE;

-- Create function to generate random alphanumeric invite code
CREATE OR REPLACE FUNCTION generate_invite_code(length INTEGER DEFAULT 8)
RETURNS VARCHAR AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars (I, O, 0, 1)
    result VARCHAR := '';
    i INTEGER;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Generate invite codes for existing groups that don't have one
DO $$
DECLARE
    group_record RECORD;
    new_code VARCHAR;
    max_attempts INTEGER := 100;
    attempts INTEGER;
BEGIN
    FOR group_record IN SELECT id FROM groups WHERE invite_code IS NULL
    LOOP
        attempts := 0;
        LOOP
            new_code := generate_invite_code(8);
            BEGIN
                UPDATE groups SET invite_code = new_code WHERE id = group_record.id;
                EXIT; -- Success, exit inner loop
            EXCEPTION WHEN unique_violation THEN
                attempts := attempts + 1;
                IF attempts >= max_attempts THEN
                    RAISE EXCEPTION 'Could not generate unique invite code after % attempts', max_attempts;
                END IF;
            END;
        END LOOP;
    END LOOP;
END $$;

-- Make invite_code NOT NULL after populating existing records
ALTER TABLE groups ALTER COLUMN invite_code SET NOT NULL;

-- Set default for new groups to auto-generate invite code
ALTER TABLE groups ALTER COLUMN invite_code SET DEFAULT generate_invite_code(8);

-- Create index for fast lookup by invite code
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);

-- Add function to regenerate invite code (for admins who want to invalidate old codes)
CREATE OR REPLACE FUNCTION regenerate_group_invite_code(group_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
    new_code VARCHAR;
    max_attempts INTEGER := 100;
    attempts INTEGER := 0;
BEGIN
    LOOP
        new_code := generate_invite_code(8);
        BEGIN
            UPDATE groups SET invite_code = new_code, updated_at = NOW() WHERE id = group_uuid;
            RETURN new_code;
        EXCEPTION WHEN unique_violation THEN
            attempts := attempts + 1;
            IF attempts >= max_attempts THEN
                RAISE EXCEPTION 'Could not generate unique invite code after % attempts', max_attempts;
            END IF;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (RLS will handle authorization)
GRANT EXECUTE ON FUNCTION regenerate_group_invite_code(UUID) TO authenticated;

-- Function to join a group by invite code
CREATE OR REPLACE FUNCTION join_group_by_invite_code(code VARCHAR, joining_user_id UUID)
RETURNS JSON AS $$
DECLARE
    target_group_id UUID;
    group_name VARCHAR;
    existing_member UUID;
BEGIN
    -- Find the group with this invite code
    SELECT id, name INTO target_group_id, group_name
    FROM groups
    WHERE invite_code = UPPER(code);
    
    IF target_group_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid invite code');
    END IF;
    
    -- Check if already a member
    SELECT id INTO existing_member
    FROM group_members
    WHERE group_id = target_group_id AND user_id = joining_user_id;
    
    IF existing_member IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'You are already a member of this group', 'group_id', target_group_id);
    END IF;
    
    -- Add user as member
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (target_group_id, joining_user_id, 'member');
    
    -- Log activity
    INSERT INTO activities (user_id, group_id, entity_type, entity_id, action, metadata)
    VALUES (joining_user_id, target_group_id, 'member', joining_user_id, 'joined', 
            json_build_object('via', 'invite_code'));
    
    RETURN json_build_object('success', true, 'group_id', target_group_id, 'group_name', group_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION join_group_by_invite_code(VARCHAR, UUID) TO authenticated;

