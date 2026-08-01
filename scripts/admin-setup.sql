-- Add credits and plans columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plans TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create admin user (email: toon15vg@gmail.com)
-- Note: You'll need to create this user through Supabase Auth dashboard first, 
-- then run the update below with the actual user ID

-- After creating the admin user in Auth, run this:
-- UPDATE profiles SET is_admin = true, credits = 999999 WHERE email = 'toon15vg@gmail.com';

-- Create index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON profiles(credits);
CREATE INDEX IF NOT EXISTS idx_profiles_plans ON profiles(plans);

-- Enable RLS policies for admin access
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON profiles FOR SELECT 
USING (
  (auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email = 'toon15vg@gmail.com'
  )) OR 
  auth.uid() = id
);

-- Create policy for admins to update profiles
CREATE POLICY "Admins can update all profiles" 
ON profiles FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email = 'toon15vg@gmail.com'
  )
);

-- Create policy for admins to insert profiles
CREATE POLICY "Admins can insert profiles" 
ON profiles FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email = 'toon15vg@gmail.com'
  )
);

-- Create an audit log table for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at);

-- Enable RLS on admin_logs
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs" 
ON admin_logs FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email = 'toon15vg@gmail.com'
  )
);
