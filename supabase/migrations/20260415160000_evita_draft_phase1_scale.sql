-- Add scale column to drawings for CAD workflow (paper size already exists)
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS scale text DEFAULT NULL;
