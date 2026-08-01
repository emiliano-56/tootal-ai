# Admin Dashboard Setup Guide

## Overview
This guide will help you set up the admin dashboard with user management and credit system.

## Step 1: Database Setup

### 1a. Run the SQL Migration Script

Copy and run the following SQL in your Supabase SQL Editor:

```sql
-- Add credits and plans columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plans TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON profiles(credits);
CREATE INDEX IF NOT EXISTS idx_profiles_plans ON profiles(plans);

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
```

### 1b. Create Admin User

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Users**
3. Click **Add user** → **Create new user**
4. Fill in:
   - Email: `toon15vg@gmail.com`
   - Password: `Danny56`
5. Click **Create user**

### 1c. Update Admin Profile

Run this SQL query with the admin user ID (copy the UUID from the user you just created):

```sql
UPDATE profiles 
SET is_admin = true, credits = 999999 
WHERE email = 'toon15vg@gmail.com';
```

## Step 2: Environment Variables

Make sure your `.env.local` has:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The service role key is needed for creating users via the admin API.

## Step 3: Access Admin Dashboard

1. Navigate to `http://localhost:3000/admin`
2. Login with:
   - Email: `toon15vg@gmail.com`
   - Password: `Danny56`

## Features

### Add New User
- Enter user email and password
- Set initial credits (default: 100)
- User is automatically created in Auth and Profile

### Add/Top Up Credits
- Select a user from dropdown
- Enter credit amount to add
- Credits are added to user's current balance

### Users Management
- View all users with their:
  - Email
  - Current credits
  - Plan type
  - Account creation date

### Admin Logs
- All admin actions are logged in `admin_logs` table
- Tracks: user creation, credit additions, and who did it

## Database Schema

### profiles table (updated)
```sql
- id (UUID) - User ID
- email (VARCHAR)
- credits (NUMERIC) - User credits balance
- plans (TEXT) - User plan type (free, pro, etc.)
- is_admin (BOOLEAN) - Admin flag
- ... existing columns
```

### admin_logs table (new)
```sql
- id (UUID) - Log ID
- admin_id (UUID) - Admin user ID
- action (TEXT) - Action type (CREATE_USER, ADD_CREDITS, etc.)
- target_user_id (UUID) - Target user ID
- details (JSONB) - Additional action details
- created_at (TIMESTAMP)
```

## API Endpoints

### POST /api/admin/create-user
Creates a new user with initial credits
```json
{
  "email": "user@example.com",
  "password": "password123",
  "credits": 100
}
```

### POST /api/admin/add-credits
Adds credits to an existing user
```json
{
  "userId": "user-uuid",
  "amount": 50
}
```

## RLS Policies

The admin dashboard has the following RLS policies:

1. **profiles**: Only admin can view/update all profiles
2. **admin_logs**: Only admin can view logs
3. Other users can only see their own profile

## Troubleshooting

### Issue: "Invalid credentials" on login
- Verify email is exactly `toon15vg@gmail.com`
- Verify password is exactly `Danny56`
- Check that user was created in Auth

### Issue: "Unauthorized" on user creation
- Ensure you're logged in as the admin
- Verify SUPABASE_SERVICE_ROLE_KEY is in .env.local
- Check that admin user exists in Auth

### Issue: Users not appearing
- Refresh the page
- Check browser console for errors
- Verify RLS policies are enabled
- Make sure profiles table has the new columns

## Security Notes

- Admin credentials (toon15vg@gmail.com / Danny56) should be changed in production
- Service role key should never be exposed in client code
- All admin actions are logged for audit purposes
- RLS policies ensure users can only see their own data

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Check Supabase logs for SQL errors
3. Verify all SQL migrations were applied
4. Ensure environment variables are set correctly
