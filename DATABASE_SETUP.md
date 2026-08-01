# Database Setup — ComicTale AI

Everything runs on **Supabase** (PostgreSQL + Auth + Storage).
No other database is needed.

There are two situations:

- **A. Existing project** → only run the migration in step 3. Nothing else changes.
- **B. Fresh Supabase project** → do steps 1–5 in order.

---

## Quick summary

| What | Status | Action |
|---|---|---|
| 6 existing tables | already live | leave alone |
| 8 new tables (AI agents) | ❌ **not created yet** | run `001_agent_foundation.sql` |
| 3 storage buckets | already live | verify they exist |
| RLS on existing tables | ✅ verified enabled | nothing to do |
| RLS on new tables | comes with the migration | — |

> **Verified on the live project:** the database currently contains only
> `admin_logs`, `book_covers`, `chats`, `colorings`, `comics`, `profiles`.
> None of the 8 agent tables exist yet, so **step 3 is still outstanding** —
> that is why Prompt Studio shows the "setup pending" warning.

---

## 1. Existing tables (already in production)

Six tables, built before the AI agents. **Do not drop or recreate them** on the
live project — the migration does not touch them.

`profiles` · `comics` · `colorings` · `book_covers` · `chats` · `admin_logs`

### `profiles`
Linked to `auth.users`. Created on signup.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | equals `auth.users.id` |
| `email` | text | |
| `username` | text | |
| `credits` | numeric / int | balance, decremented on generation |
| `plans` | text | e.g. "ToonTale AI Studio" |

### `comics`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid | → `auth.users.id` |
| `title` | text | |
| `pdf_path` | text | path inside the `comic-pdfs` bucket |
| `created_at` | timestamptz | |

### `colorings`
Same shape as `comics`.

### `book_covers`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid | |
| `name` | text | filename |
| `image_path` | text | path inside the `book-covers` bucket |
| `prompt` | text | |
| `created_at` | timestamptz | |

### `chats`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid | |
| `title` | text | |
| `messages` | **jsonb** | array of `{id, type, content, timestamp}` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `admin_logs`
Audit trail for admin actions (add credits, create user, reset password).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `admin_id` | uuid | who performed the action |
| `action` | text | e.g. "add_credits" |
| `target_user_id` | uuid | who it was performed on |
| `details` | jsonb | action payload |
| `created_at` | timestamptz | |

> Written via the **service role** client (`lib/supabase-admin.ts`), which
> bypasses RLS by design.

---

## 2. Storage buckets

Supabase Dashboard → **Storage**. Three buckets are required:

| Bucket | Used by | Access |
|---|---|---|
| `comic-pdfs` | Comic + coloring PDFs, My Library thumbnails | **Private** (signed URLs) |
| `video` | Generated videos | **Public** (played directly in `<video>`) |
| `book-covers` | Saved cover images | **Private** (signed URLs) |

> The app reads PDFs with `createSignedUrl`, so `comic-pdfs` and `book-covers`
> must stay private. `video` is read with `getPublicUrl`, so it must be public —
> if you make it private, saved videos will not play.

Storage policies for each private bucket (Storage → bucket → Policies) —
files are stored under `{user_id}/filename`, so this restricts users to their
own folder:

```sql
-- Repeat for: comic-pdfs, book-covers, video
create policy "own folder read"
on storage.objects for select
using (
  bucket_id = 'comic-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "own folder write"
on storage.objects for insert
with check (
  bucket_id = 'comic-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "own folder delete"
on storage.objects for delete
using (
  bucket_id = 'comic-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 3. ⚠️ Run the migration (REQUIRED)

This is the only mandatory step for an existing project.

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Open `supabase/migrations/001_agent_foundation.sql` from the repo
3. Paste the whole file → **Run**

It is safe to run more than once (everything is `IF NOT EXISTS` / `OR REPLACE`)
and it does not modify the 5 existing tables.

### What it creates

| Table | Purpose |
|---|---|
| `projects` | One idea → a whole package (AI Business Agent) |
| `agent_jobs` | Tracks every agent run, so a page refresh does not lose work |
| `comic_pages` | Page-level comic data |
| `comic_panels` | Panel art + dialogue + speech-bubble positions |
| `landing_pages` | Generated sales pages (JSON config + HTML) |
| `custom_domains` | Domain mapping + DNS verification token |
| `marketing_assets` | Ads, emails, SEO copy |
| `prompt_library` | Prompt Studio — seeds **22 built-in prompts** |

It also:
- enables **Row Level Security** on all 8 tables (owner-only access)
- allows anonymous read of **published** landing pages only
- adds an `updated_at` trigger
- seeds the prompt library across 11 categories

### Why `comic_pages` / `comic_panels` matter

Today a finished comic is stored **only as a PDF path**. The individual panels,
dialogue and bubble positions are thrown away, so a comic can never be edited or
reused after generation. These two tables keep that structured data.

---

## 4. Verify it worked

Run this in the SQL Editor — it should return **8 rows**:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'projects','agent_jobs','comic_pages','comic_panels',
    'landing_pages','custom_domains','marketing_assets','prompt_library'
  )
order by table_name;
```

Confirm the seed data — should return **22**:

```sql
select count(*) from public.prompt_library where is_builtin = true;
```

Confirm RLS is on — all 8 should show `rowsecurity = true`:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'projects','agent_jobs','comic_pages','comic_panels',
    'landing_pages','custom_domains','marketing_assets','prompt_library'
  );
```

**In the app:** open `/prompt-studio`. If the migration worked you will see the
prompt library populated. If not, it shows:

> *Database setup pending — run supabase/migrations/001_agent_foundation.sql…*

---

## 5. Environment variables

Copy `.env.example` → `.env.local` and fill in from
Supabase Dashboard → **Project Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...      # "anon public" key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...          # "service_role" key — SECRET
DEEPSEEK_API_KEY=sk-...
NEXT_PUBLIC_API_URL=https://zoop-a1-v2.onrender.com
```

Restart the dev server after editing — Next.js only reads env vars at boot.

> `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row Level Security. Never expose it to
> the browser and never prefix it with `NEXT_PUBLIC_`.

---

## 6. Fresh project only — auth & profile trigger

If starting from an empty Supabase project, a `profiles` row must be created
whenever someone signs up. The app currently inserts it from the signup form, but
a trigger is more reliable (it also covers OAuth signups):

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, credits, plans)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    0,
    'Free Plan'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

And RLS for `profiles` (users read/update only their own row):

```sql
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
```

---

## 7. RLS on existing tables — already verified ✅

Checked on the live project — **all five return `rowsecurity = true`**:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','comics','colorings','book_covers','chats');
```

| tablename | rowsecurity |
|---|---|
| book_covers | true |
| chats | true |
| colorings | true |
| comics | true |
| profiles | true |

**No action needed.** Row Level Security is on, so one user cannot read
another's comics or chats.

### One thing still worth confirming

RLS being enabled is only half the story — the **policies** behind it decide
what is actually allowed. List them with:

```sql
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Each user-owned table should have a policy comparing `auth.uid()` to `user_id`
(or to `id` on `profiles`). If a table has RLS on but **no** policy, all access
is denied and that feature silently breaks.

Best final check: log in as two different accounts and confirm neither can see
the other's comics.

---

## Checklist

- [ ] 3 storage buckets exist (`comic-pdfs` private, `book-covers` private, `video` public)
- [ ] **`001_agent_foundation.sql` run — 8 tables created**  ← still outstanding
- [ ] `prompt_library` returns 22 built-in rows
- [ ] RLS on for all 8 new tables
- [x] RLS enabled on the existing tables — verified
- [ ] Policies listed and sanity-checked (section 7)
- [ ] `.env.local` filled in, dev server restarted
- [ ] `/prompt-studio` shows prompts instead of the setup warning
