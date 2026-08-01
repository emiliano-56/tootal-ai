-- Create book_covers table with image_path instead of url
CREATE TABLE public.book_covers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_path TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX book_covers_user_id_idx ON public.book_covers(user_id);
CREATE INDEX book_covers_created_at_idx ON public.book_covers(created_at DESC);

-- Enable RLS
ALTER TABLE public.book_covers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own covers" ON public.book_covers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own covers" ON public.book_covers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own covers" ON public.book_covers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own covers" ON public.book_covers
  FOR DELETE USING (auth.uid() = user_id);