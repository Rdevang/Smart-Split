-- Create feedback type enum
CREATE TYPE public.feedback_type AS ENUM ('suggestion', 'feature_request', 'bug_report', 'other');
CREATE TYPE public.feedback_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.feedback_status AS ENUM ('new', 'reviewing', 'planned', 'in_progress', 'completed', 'declined');

-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type public.feedback_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority public.feedback_priority DEFAULT 'medium',
    status public.feedback_status DEFAULT 'new',
    
    -- User info (optional for anonymous)
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    email VARCHAR(255),
    name VARCHAR(100),
    
    -- Device/Browser info
    user_agent TEXT,
    page_url TEXT,
    
    -- Admin response
    admin_response TEXT,
    responded_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_feedback_type ON public.feedback(type);
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at DESC);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert feedback (even anonymous)
CREATE POLICY "Anyone can submit feedback"
    ON public.feedback FOR INSERT
    WITH CHECK (true);

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view own feedback"
    ON public.feedback FOR SELECT
    USING (
        user_id = auth.uid() OR
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Trigger for updated_at
CREATE TRIGGER update_feedback_updated_at
    BEFORE UPDATE ON public.feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Analyze table
ANALYZE public.feedback;

