-- Add location fields to expenses table
-- Supports both manual text entry and GPS coordinates

-- Add location name (e.g., "Starbucks", "Times Square", "123 Main St")
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add GPS coordinates for map display (stored as JSON: {lat: number, lng: number})
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS location_coordinates JSONB;

-- Add index for location searches
CREATE INDEX IF NOT EXISTS idx_expenses_location ON public.expenses(location);

-- Add spatial index on coordinates (for future proximity searches)
CREATE INDEX IF NOT EXISTS idx_expenses_coordinates ON public.expenses USING GIN (location_coordinates);

COMMENT ON COLUMN public.expenses.location IS 'Human-readable location name or address';
COMMENT ON COLUMN public.expenses.location_coordinates IS 'GPS coordinates as {lat: number, lng: number}';

