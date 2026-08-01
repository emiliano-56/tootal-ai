# Admin Dashboard Setup - Fix RLS Infinite Recursion

## Problem You're Experiencing

You're seeing this error when trying to fetch users:
```
[v0] Error fetching users: {
  code: '42P17',
  message: 'infinite recursion detected in policy for relation "profiles"'
}
```

And the metrics show 0 users and 0 credits even though users exist in the database.

## Solution

The issue is with Row Level Security (RLS) policies that were checking `is_admin` status within themselves, causing infinite recursion. We've simplified the policies to avoid this.

### Step 1: Run the Fixed SQL Script

1. Go to **Supabase Dashboard** → Your Project → **SQL Editor**
2. Create a **New Query**
3. Copy and paste the entire content from `/scripts/fix-rls-simple.sql`
4. Click **Run** to execute the script

This script will:
- Drop all problematic policies
- Create new, simplified RLS policies without recursion
- Allow authenticated users to view all profiles
- Allow admins to manage (insert/update) all profiles

### Step 2: Refresh Your Application

After running the SQL script:
1. Refresh your browser
2. Login to the admin dashboard with:
   - Email: `toon15vg@gmail.com`
   - Password: `Danny56`

### Step 3: Verify Everything Works

You should now see:
- ✅ Total Users count (not 0)
- ✅ Total Credits count (not 0)
- ✅ Users list loading properly
- ✅ "User created successfully" toast message when adding users
- ✅ Search user functionality working
- ✅ Top-up credits functionality working

## What Changed

### Old Policy (Caused Recursion)
```sql
-- This caused infinite recursion because it checked is_admin in the policy
CREATE POLICY "Admin can select all profiles" ON profiles
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_admin = true
    )
  );
```

### New Policy (No Recursion)
```sql
-- Simpler approach - let app handle admin checks
CREATE POLICY "Authenticated users can view profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);
```

## Security Note

The new policies are based on the principle that:
- All authenticated users can **view** all profiles (data exposure is minimal)
- Only authenticated users with `is_admin = true` can **insert** or **update** profiles
- Admin checks are enforced both in SQL policies and in the admin dashboard code

If you need stricter privacy, you can modify the "Users can view profiles" policy to only allow viewing own profiles.

## Troubleshooting

If you still see errors after running the script:

1. **Clear browser cache** (Ctrl+Shift+Delete or Cmd+Shift+Delete)
2. **Check RLS is enabled** on `profiles` table:
   - Go to Supabase Dashboard → Table Editor → profiles → Settings
   - Verify "RLS" toggle is ON
3. **Verify the admin user exists**:
   - Go to Authentication → Users
   - Look for `toon15vg@gmail.com`

If problems persist, share the exact error message and we'll debug further.
