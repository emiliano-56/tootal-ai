# AI Keys & API Configuration

All keys live in **`.env.local`** (gitignored — never commit or zip it).
Copy `.env.example` → `.env.local` on a new machine.

**Restart the dev server after any change** — Next.js only reads env vars at boot.

---

## 1. Keys currently in use

| Key | Used for | Where it's read |
|---|---|---|
| `DEEPSEEK_API_KEY` | **All text agents** — comic script, marketing, landing page, cover copy, prompt enhancer, chat | `lib/ai/deepseek.ts` |
| `NEXT_PUBLIC_SUPABASE_URL` | Database + storage | `lib/supabase.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser DB access (safe to expose, RLS-protected) | `lib/supabase.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin actions (create user, add credits) | `lib/supabase-admin.ts` |
| `NEXT_PUBLIC_API_URL` | **Image + video generation** backend | `/comic`, `/coloring`, `/cover`, `/video`, agents |

---

## 2. Which agent uses which key

### DeepSeek (`DEEPSEEK_API_KEY`) — text
```
app/api/agent/comic-script/route.ts     Story, scenes, panels, dialogue
app/api/agent/marketing/route.ts        Ads, emails, social, blog, SEO
app/api/agent/landing-page/route.ts     Sales page copy + sections
app/api/agent/cover-copy/route.ts       Title, blurb, art direction
app/api/agent/enhance-prompt/route.ts   Prompt enhancer
app/api/chat/route.ts                   Prompt chat
app/api/book-generation/route.ts        Book generation
```
All new agents go through `lib/ai/deepseek.ts` — a single client with JSON
parsing, retries and error handling.

### Generation backend (`NEXT_PUBLIC_API_URL`) — images & video
```
/coloring/generate-comic-story   Comic story
/coloring/generate-image         Comic panel art  (Story-to-Comic agent)
/comic/generate-coloring-book    Coloring book
/comic/generate-image            Coloring page art
/nano/generate-image             Cover artwork    (Cover Designer agent)
/nano/download-image             Image download
/text-video/generate-video       Text to video
```

### No key needed — runs in the browser
```
Comic-to-Video     canvas + MediaRecorder   lib/video/ken-burns.ts
Speech bubbles     canvas                   lib/comic/bubbles.ts
PDF page extract   pdf.js                   lib/pdf/client.ts
Product mockups    canvas                   lib/mockup/book-mockup.ts
Landing page HTML  string template          lib/landing/render.ts
```

---

## 3. Changing a key

Edit `.env.local`, then restart (`Ctrl+C`, `npm run dev`):

```env
DEEPSEEK_API_KEY=sk-your-new-key
```

---

## 4. Adding a NEW AI provider (e.g. OpenAI, Claude, Gemini)

**Step 1** — add the key to `.env.local` and `.env.example`:
```env
OPENAI_API_KEY=sk-...
```

**Step 2** — create a client next to the existing one, e.g. `lib/ai/openai.ts`.
Mirror the shape of `lib/ai/deepseek.ts` so it exports `complete()` and
`completeJson()`. Every agent already depends only on those two functions.

**Step 3** — switch an agent by changing one import:
```ts
// before
import { completeJson } from '@/lib/ai/deepseek'
// after
import { completeJson } from '@/lib/ai/openai'
```

Nothing else in the agent needs to change — that is why the shared client exists.

---

## 5. ⚠️ Security issues still open

Two secrets are **hardcoded in source**, so they travel inside any zip or repo:

| File | Line | Problem |
|---|---|---|
| `lib/supabase-admin.ts` | 8 | **`service_role` key** — bypasses ALL row-level security. Anyone with it can read, edit or delete every user's data. |
| `app/api/chat/route.ts` | 17 | DeepSeek key fallback |
| `app/api/book-generation/route.ts` | 17 | DeepSeek key fallback |

`lib/supabase.ts` also hardcodes the anon key, but that one is designed to be
public and is protected by RLS — lower risk.

**Fix:** delete the hardcoded fallbacks and read only from `process.env`, the way
`lib/ai/deepseek.ts` already does. The values are already in `.env.local`, so
nothing will break.
