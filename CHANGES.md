# Changed Files

Total: 59 files (39 new, 20 modified)

## New Files — AI Agents

```
supabase/migrations/001_agent_foundation.sql

lib/ai/deepseek.ts
lib/agents/types.ts
lib/agents/registry.ts
lib/comic/bubbles.ts
lib/landing/render.ts
lib/video/ken-burns.ts
lib/pdf/client.ts
components/library-picker.tsx

app/api/agent/enhance-prompt/route.ts
app/api/agent/marketing/route.ts
app/api/agent/landing-page/route.ts
app/api/agent/comic-script/route.ts
app/api/agent/cover-copy/route.ts

app/(shell)/business-agent/page.tsx
app/(shell)/comic-agent/page.tsx
app/(shell)/comic-video/page.tsx
app/(shell)/cover-designer/page.tsx
app/(shell)/landing-pages/page.tsx
app/(shell)/marketing/page.tsx
app/(shell)/prompt-studio/page.tsx

components/agent-ui.tsx
components/business-agent.tsx
components/story-comic-agent.tsx
components/comic-video-studio.tsx
components/cover-designer.tsx
components/landing-builder.tsx
components/marketing-generator.tsx
components/prompt-studio.tsx

.env.example
.env.local            (gitignored - do NOT share)
```

## New Files — UI

```
app/(shell)/layout.tsx
app/(shell)/analytics/page.tsx
components/analytics-dashboard.tsx
components/option-picker.tsx
components/pdf-thumbnail.tsx
components/stats-row.tsx
components/quick-actions.tsx
components/getting-started.tsx
components/activity-chart.tsx
scripts/copy-pdf-worker.js
public/pdf.worker.min.mjs
```

## Modified Files

```
app/layout.tsx
app/globals.css
components/sidebar.tsx
components/hero-section.tsx
app/(shell)/dashboard/page.tsx
app/(shell)/comic/page.tsx
app/(shell)/video/page.tsx
app/(shell)/coloring/page.tsx
app/(shell)/my-comics/page.tsx
app/(shell)/cover/page.tsx
app/(shell)/credits/page.tsx
app/(shell)/chat/page.tsx
app/(shell)/dfy-prompts/page.tsx
app/(shell)/reseller/page.tsx
app/(shell)/white-labels/page.tsx
app/(shell)/support/page.tsx
components/sidebar.tsx
package.json
package-lock.json
.gitignore
```

## Documentation

```
DATABASE_SETUP.md     Full DB setup guide for the developer
AI_KEYS.md            Which AI key is used where, how to change/add one
CHANGES.md            This file
.env.example          Template for .env.local
```

## Pending Setup

Run once in Supabase Dashboard → SQL Editor:

```
supabase/migrations/001_agent_foundation.sql
```

See DATABASE_SETUP.md for the full checklist.

## Folder Moved

```
app/<name>/        →   app/(shell)/<name>/
```

Applies to: dashboard, analytics, comic, coloring, video, my-comics, cover,
credits, chat, dfy-prompts, reseller, white-labels, support
