-- ============================================================================
-- REVIEWS / TESTIMONIALS TABLE
-- Public reviews displayed on the homepage
-- ============================================================================

-- 1. Create reviews table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Author info
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    author_title TEXT, -- e.g., "Travel Enthusiast", "Roommate", "Team Lead"
    author_avatar_url TEXT,
    
    -- Review content
    content TEXT NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5) DEFAULT 5,
    
    -- Moderation
    is_approved BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id)
);

-- Index for fetching latest approved reviews
CREATE INDEX IF NOT EXISTS idx_reviews_approved_latest 
    ON public.reviews(is_approved, created_at DESC) 
    WHERE is_approved = true;

-- 2. RLS Policies
-- ============================================================================
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved reviews (public testimonials)
CREATE POLICY "Anyone can view approved reviews"
    ON public.reviews FOR SELECT
    USING (is_approved = true);

-- Authenticated users can submit reviews
CREATE POLICY "Authenticated users can submit reviews"
    ON public.reviews FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Users can update their own pending reviews
CREATE POLICY "Users can update own pending reviews"
    ON public.reviews FOR UPDATE
    TO authenticated
    USING (user_id = (select auth.uid()) AND is_approved = false)
    WITH CHECK (user_id = (select auth.uid()));

-- Site admins can manage all reviews
CREATE POLICY "Admins can manage all reviews"
    ON public.reviews FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (select auth.uid()) AND role = 'site_admin'
        )
    );

-- 3. Seed some initial reviews
-- ============================================================================
INSERT INTO public.reviews (author_name, author_title, content, rating, is_approved, is_featured, created_at) VALUES
(
    'Sarah Chen',
    'Travel Enthusiast',
    'SmartSplit made our group trip so much easier. No more awkward conversations about money or spreadsheets. Everyone knows exactly what they owe.',
    5,
    true,
    true,
    NOW() - INTERVAL '30 days'
),
(
    'Marcus Rodriguez',
    'Roommate',
    'Living with 3 roommates used to be a nightmare for bills. Now we just add expenses and settle up at the end of the month. Simple and fair!',
    5,
    true,
    true,
    NOW() - INTERVAL '20 days'
),
(
    'Priya Sharma',
    'Team Lead',
    'Perfect for splitting team lunch orders and office supplies. The analytics feature helps us track spending patterns too. Highly recommend!',
    5,
    true,
    true,
    NOW() - INTERVAL '10 days'
),
(
    'Alex Thompson',
    'College Student',
    'Finally an app that actually works for splitting bills. The QR code feature is genius - my friends joined our apartment group in seconds.',
    5,
    true,
    true,
    NOW() - INTERVAL '5 days'
),
(
    'Emily Watson',
    'Event Organizer',
    'Organized a wedding party with 12 people and SmartSplit handled all the expenses beautifully. The simplified debts feature saved us hours of calculations.',
    5,
    true,
    false,
    NOW() - INTERVAL '2 days'
);

-- 4. Add review type to feedback enum
-- ============================================================================
-- Add 'review' to the feedback_type enum if it doesn't exist
DO $$
BEGIN
    -- Check if 'review' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'review' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feedback_type')
    ) THEN
        ALTER TYPE feedback_type ADD VALUE 'review';
    END IF;
END $$;

