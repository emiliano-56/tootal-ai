-- =====================================================================
--  014 — The ten Done For You businesses
-- =====================================================================
--  Seed content for OTO 2. Every row is editable from Superadmin, so
--  this is a starting library rather than a fixed one.
--
--  Each niche ships nine assets: a website, two storybooks, a video
--  script, a rhyme, a printable pack, an AI tutor, a blog post and the
--  marketplace listings that sell them. Where an asset needs artwork the
--  `prompt` column holds what to hand the matching generator, so a pack
--  is finished inside the product rather than exported half-done.
--
--  Generated — re-running replaces the library with these values and
--  discards edits made in the console. Safe to re-run only if that is
--  what you want.
-- =====================================================================


-- ---------------------------------------------------------------------
--  THE NICHES
-- ---------------------------------------------------------------------

insert into public.dfy_niches
  (slug, name, tagline, description, audience, emoji, colour_from, colour_to, keywords, sort_order)
values
  ('bedtime-animal-tales', 'Bedtime Animal Tales', 'Calm animal stories that end the day gently', 'Bedtime is a battle in most homes, and parents will pay for anything that makes the last twenty minutes of the day easier.', 'Children aged 3-6, read aloud by a parent', '🌙', '#6366f1', '#a855f7', array['bedtime stories for kids', 'animal stories', 'calm down books', 'toddler bedtime book', 'read aloud stories'], 10),
  ('little-space-explorers', 'Little Space Explorers', 'Space science disguised as an adventure', 'Parents want screen-free STEM and schools want reading material that teaches something. Space is the one science topic every child says yes to.', 'Children aged 5-9, curious about how things work', '🚀', '#0ea5e9', '#6366f1', array['space books for kids', 'STEM story books', 'planets for children', 'astronaut story', 'science books age 6'], 20),
  ('dino-discovery-club', 'Dino Discovery Club', 'Dinosaurs, facts first, adventure second', 'Almost every child goes through a dinosaur phase, and during it they will consume anything with a dinosaur on the cover. It is the most reliable evergreen niche in kids publishing.', 'Children aged 4-8 in the dinosaur phase', '🦕', '#f59e0b', '#84cc16', array['dinosaur books for kids', 'dinosaur facts children', 'T-rex story book', 'paleontology for kids', 'dinosaur colouring book'], 30),
  ('ocean-friends-academy', 'Ocean Friends Academy', 'Sea life, friendship and looking after the water', 'Ocean themes sell year-round to parents, nurseries and gift buyers, and carry an environmental message schools actively look for.', 'Children aged 3-7 who love animals', '🐙', '#06b6d4', '#3b82f6', array['ocean books for kids', 'sea animals children', 'under the sea story', 'ocean conservation kids', 'marine life book'], 40),
  ('tiny-superheroes', 'Tiny Superheroes', 'Everyday courage, cape optional', 'Superhero content sells itself, but parents want the values without the violence. This pack is the version they are looking for and rarely find.', 'Children aged 5-9 who want to be the hero', '🦸', '#ef4444', '#f59e0b', array['superhero books for kids', 'kids courage story', 'social emotional learning book', 'brave kids book', 'superhero colouring'], 50),
  ('fairy-garden-adventures', 'Fairy Garden Adventures', 'Tiny magic in an ordinary back garden', 'Fairy themes are the highest-converting category on Etsy for children''s printables, and the audience buys repeatedly rather than once.', 'Children aged 4-8 who like small worlds', '🧚', '#ec4899', '#a855f7', array['fairy books for kids', 'fairy garden printables', 'magical story children', 'nature fairy book', 'fairy colouring pages'], 60),
  ('kind-kids-club', 'Kind Kids Club', 'Feelings, friendship and getting it wrong', 'Social-emotional learning is on every school curriculum and every parenting bestseller list, and there is far more demand than there is good material.', 'Children aged 4-8, and the adults navigating it with them', '💛', '#f97316', '#eab308', array['social emotional learning books', 'kindness books for kids', 'feelings book children', 'friendship story kids', 'emotions colouring book'], 70),
  ('little-chefs-kitchen', 'Little Chefs Kitchen', 'Food, measuring and eating the evidence', 'Cooking with children is a niche where parents buy books, printables and courses — and the same customer comes back for the next age band.', 'Children aged 5-10 who want to help in the kitchen', '🥕', '#22c55e', '#eab308', array['cooking with kids book', 'kids recipes children', 'first cookbook for children', 'kitchen skills kids', 'food colouring pages'], 80),
  ('dream-machines', 'Dream Machines', 'Diggers, trains and everything with wheels', 'Vehicle books are the single most reliable way to get a reluctant three-to-five-year-old reader to sit still, and parents know it.', 'Children aged 3-7, especially reluctant readers', '🚜', '#f59e0b', '#ef4444', array['truck books for toddlers', 'construction vehicles kids', 'digger book children', 'train story toddler', 'vehicle colouring book'], 90),
  ('world-explorers', 'World Explorers', 'One country, one story, one thing you did not know', 'Geography and culture packs sell to homeschoolers and to schools, and the format extends to as many countries as you are willing to write.', 'Children aged 6-10, and homeschooling families', '🌍', '#14b8a6', '#3b82f6', array['geography books for kids', 'countries of the world children', 'multicultural kids books', 'homeschool geography', 'world cultures kids'], 100)
on conflict (slug) do update set
  name        = excluded.name,
  tagline     = excluded.tagline,
  description = excluded.description,
  audience    = excluded.audience,
  emoji       = excluded.emoji,
  colour_from = excluded.colour_from,
  colour_to   = excluded.colour_to,
  keywords    = excluded.keywords,
  sort_order  = excluded.sort_order;


-- ---------------------------------------------------------------------
--  THE ASSETS
-- ---------------------------------------------------------------------
--  Replaced wholesale: an asset removed from the generator should not
--  linger in the library.

delete from public.dfy_assets
 where niche_id in (select id from public.dfy_niches where slug in ('bedtime-animal-tales', 'little-space-explorers', 'dino-discovery-club', 'ocean-friends-academy', 'tiny-superheroes', 'fairy-garden-adventures', 'kind-kids-club', 'little-chefs-kitchen', 'dream-machines', 'world-explorers'));

insert into public.dfy_assets
  (niche_id, kind, title, summary, body, prompt, tool, meta, marketplaces, sort_order)
values
  ((select id from public.dfy_niches where slug = 'bedtime-animal-tales'), 'website', 'Bedtime Animal Tales — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bedtime Animal Tales — Calm animal stories that end the day gently</title>
<meta name="description" content="Calm animal stories that end the day gently. Children aged 3-6, read aloud by a parent.">
<style>
  :root { --from: #6366f1; --to: #a855f7; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">🌙</div>
    <h1>Bedtime Animal Tales</h1>
    <p>Calm animal stories that end the day gently — written for children aged 3-6, read aloud by a parent.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Bedtime is a battle in most homes, and parents will pay for anything that makes the last twenty minutes of the day easier.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>When the stars stop humming, Moss walks the whole meadow to find out why — and discovers they were only waiting for someone to stop and listen.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Moss, Pip and Old Wren appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Slow Down, Little One" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>Old Wren answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$19</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy Bedtime Animal Tales</a>
  </div>
</section>

<footer><div class="wrap">© Bedtime Animal Tales. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'bedtime-animal-tales'), 'storybook', 'The Night the Stars Went Quiet', 'When the stars stop humming, Moss walks the whole meadow to find out why — and discovers they were only waiting for someone to stop and listen.', '# The Night the Stars Went Quiet

**Logline.** When the stars stop humming, Moss walks the whole meadow to find out why — and discovers they were only waiting for someone to stop and listen.

**Cast.** Moss — a slow, kind hedgehog who is never in a hurry; Pip — an excitable dormouse who has to learn to settle; Old Wren — the storyteller of the hollow

## Twelve-page beat sheet

1. We meet Moss doing the thing Moss always does.
2. Something is not where it should be.
3. Moss decides to find out why, against advice.
4. Pip comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Old Wren, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Pip says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Moss fixes it in a way only Moss would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Moss: small round hedgehog, soft brown quills, sleepy eyes, tiny green scarf
Pip: tiny golden dormouse, huge round ears, always mid-yawn
Old Wren: plump brown wren, half-moon spectacles, perched on a lantern

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Night the Stars Went Quiet" for children aged 3-6, read aloud by a parent.

Logline: When the stars stop humming, Moss walks the whole meadow to find out why — and discovers they were only waiting for someone to stop and listen.

Cast, drawn identically on every page:
Moss: small round hedgehog, soft brown quills, sleepy eyes, tiny green scarf
Pip: tiny golden dormouse, huge round ears, always mid-yawn
Old Wren: plump brown wren, half-moon spectacles, perched on a lantern

Follow this beat sheet, one page per beat:
1. We meet Moss doing the thing Moss always does.
2. Something is not where it should be.
3. Moss decides to find out why, against advice.
4. Pip comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Old Wren, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Pip says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Moss fixes it in a way only Moss would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 3-6, read aloud by a parent","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'bedtime-animal-tales'), 'storybook', 'Pip Cannot Sleep', 'Pip has too many thoughts for one small head, so Moss teaches him to put each one in a leaf boat and let it float away.', '# Pip Cannot Sleep

**Logline.** Pip has too many thoughts for one small head, so Moss teaches him to put each one in a leaf boat and let it float away.

**Cast.** Moss — a slow, kind hedgehog who is never in a hurry; Pip — an excitable dormouse who has to learn to settle; Old Wren — the storyteller of the hollow

## Twelve-page beat sheet

1. We meet Moss doing the thing Moss always does.
2. Something is not where it should be.
3. Moss decides to find out why, against advice.
4. Pip comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Old Wren, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Pip says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Moss fixes it in a way only Moss would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Moss: small round hedgehog, soft brown quills, sleepy eyes, tiny green scarf
Pip: tiny golden dormouse, huge round ears, always mid-yawn
Old Wren: plump brown wren, half-moon spectacles, perched on a lantern

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "Pip Cannot Sleep" for children aged 3-6, read aloud by a parent.

Logline: Pip has too many thoughts for one small head, so Moss teaches him to put each one in a leaf boat and let it float away.

Cast, drawn identically on every page:
Moss: small round hedgehog, soft brown quills, sleepy eyes, tiny green scarf
Pip: tiny golden dormouse, huge round ears, always mid-yawn
Old Wren: plump brown wren, half-moon spectacles, perched on a lantern

Follow this beat sheet, one page per beat:
1. We meet Moss doing the thing Moss always does.
2. Something is not where it should be.
3. Moss decides to find out why, against advice.
4. Pip comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Old Wren, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Pip says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Moss fixes it in a way only Moss would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 3-6, read aloud by a parent","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'bedtime-animal-tales'), 'video', 'Bedtime Animal Tales — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# Bedtime Animal Tales — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "When the stars stop humming, Moss walks the whole meadow to find out why — and discovers they were only waiting for someone to stop and listen…"
On screen: Moss, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Moss and the world in two sentences. No backstory.
Visual: wide establishing shot, Moss small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Pip reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: Old Wren asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New bedtime animal tales story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. small round hedgehog, soft brown quills, sleepy eyes, tiny green scarf, wide establishing shot, golden hour, soft 3D Pixar style
2. Moss noticing the problem, close-up, worried expression, same style
3. tiny golden dormouse, huge round ears, always mid-yawn, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "Bedtime Animal Tales".

Audience: Children aged 3-6, read aloud by a parent
Premise: When the stars stop humming, Moss walks the whole meadow to find out why — and discovers they were only waiting for someone to stop and listen.

Characters, identical in every scene:
Moss: small round hedgehog, soft brown quills, sleepy eyes, tiny green scarf
Pip: tiny golden dormouse, huge round ears, always mid-yawn
Old Wren: plump brown wren, half-moon spectacles, perched on a lantern

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'bedtime-animal-tales'), 'rhyme', 'Slow Down, Little One', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Slow Down, Little One

Slow down, little one, the day is done,
The moon has climbed the hill.
The wind has hushed, the birds have gone,
And even brooks are still.

Soft goes the hedgehog, soft goes the mouse,
Soft go the lights in every house.
Close up your eyes and count to three —
One for the moon, and two for me.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
Slow down, little one, the day is done,
The moon has climbed the hill.
The wind has hushed, the birds have gone,
And even brooks are still.

Soft goes the hedgehog, soft goes the mouse,
Soft go the lights in every house.
Close up your eyes and count to three —
One for the moon, and two for me.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Moss: small round hedgehog, soft brown quills, sleepy eyes, tiny green scarf
Pip: tiny golden dormouse, huge round ears, always mid-yawn
Old Wren: plump brown wren, half-moon spectacles, perched on a lantern
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'bedtime-animal-tales'), 'printable', 'Bedtime Animal Tales printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# Bedtime Animal Tales printable pack

1. Moss the hedgehog curled asleep under a leaf
2. The meadow at night with seven stars to count
3. Pip the dormouse in a leaf boat
4. A bedtime routine chart with six steps

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
Moss the hedgehog curled asleep under a leaf

Characters if shown: Moss: small round hedgehog, soft brown quills, sleepy eyes, tiny green scarf
Pip: tiny golden dormouse, huge round ears, always mid-yawn
Old Wren: plump brown wren, half-moon spectacles, perched on a lantern', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'bedtime-animal-tales'), 'tutor', 'Moss — AI tutor', 'An in-character tutor who answers questions about winding down, naming feelings and getting ready for sleep.', '# Moss — AI tutor

## System prompt

You are Moss, a slow, kind hedgehog who is never in a hurry.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Moss.
- Never discuss anything frightening, adult or unsafe. Redirect gently to winding down, naming feelings and getting ready for sleep.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Moss, a friendly character who teaches children about winding down, naming feelings and getting ready for sleep.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Moss","subject":"winding down, naming feelings and getting ready for sleep"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'bedtime-animal-tales'), 'blog', 'Why the Same Bedtime Story Every Night Is Good for Your Child', 'A finished article for the site, written to be found in search.', '# Why the Same Bedtime Story Every Night Is Good for Your Child

Bedtime is a battle in most homes, and parents will pay for anything that makes the last twenty minutes of the day easier.

## Repetition is how young children build a sense of safety

Repetition is how young children build a sense of safety — they already know what happens, so nothing in the day is left unresolved.

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

A story with a slow rhythm lowers a child''s heart rate in a way a screen never does.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

Reading the same book lets a three-year-old "read" it back to you, which is the first real step into literacy.

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. The Night the Stars Went Quiet works well because when the stars stop humming, moss walks the whole meadow to find out why — and d… and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*Bedtime Animal Tales is a complete collection of stories, videos, rhymes and printables for
children aged 3-6, read aloud by a parent.*', null, null, '{"words":620,"keywords":["bedtime stories for kids","animal stories","calm down books"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'bedtime-animal-tales'), 'listing', 'Bedtime Animal Tales — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — Bedtime Animal Tales

## Amazon KDP

**Title.** The Night the Stars Went Quiet
**Subtitle.** Calm animal stories that end the day gently — a Bedtime Animal Tales story for children aged 3-6, read aloud by a parent

**Description.**
When the stars stop humming, Moss walks the whole meadow to find out why — and discovers they were only waiting for someone to stop and listen.

Meet Moss, Pip, Old Wren — the cast of Bedtime Animal Tales, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 3-6, read aloud by a parent
- Part of the Bedtime Animal Tales series

**Seven keywords.** bedtime stories for kids, animal stories, calm down books, toddler bedtime book, read aloud stories, bedtime animal tales

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $8.99 paperback / $2.99 Kindle

---

## Etsy

**Title.** Bedtime Animal Tales Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from Bedtime Animal Tales. Calm animal stories that end the day gently.

WHAT YOU GET
• Moss the hedgehog curled asleep under a leaf
• The meadow at night with seven stars to count
• Pip the dormouse in a leaf boat
• A bedtime routine chart with six steps

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** bedtime stories for kids, animal stories, calm down books, toddler bedtime book, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $12

---

## Gumroad

**Product name.** Bedtime Animal Tales — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
Bedtime Animal Tales range, with commercial rights.

**Description.**
Bedtime is a battle in most homes, and parents will pay for anything that makes the last twenty minutes of the day easier.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $19

---

## YouTube

**Title.** The Night the Stars Went Quiet | Bedtime Animal Tales Episode 1
**Short title.** Slow Down, Little One 🎵 | Bedtime Animal Tales

**Description.**
When the stars stop humming, Moss walks the whole meadow to find out why — and discovers they were only waiting for someone to stop and listen.

Subscribe for a new bedtime animal tales story every week.

00:00 The Night the
00:05 The story begins
01:15 How it ends

**Tags.** bedtime stories for kids, animal stories, calm down books, toddler bedtime book, read aloud stories, kids story, story time, read aloud
**Thumbnail.** Moss centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90),
  ((select id from public.dfy_niches where slug = 'little-space-explorers'), 'website', 'Little Space Explorers — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Little Space Explorers — Space science disguised as an adventure</title>
<meta name="description" content="Space science disguised as an adventure. Children aged 5-9, curious about how things work.">
<style>
  :root { --from: #0ea5e9; --to: #6366f1; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">🚀</div>
    <h1>Little Space Explorers</h1>
    <p>Space science disguised as an adventure — written for children aged 5-9, curious about how things work.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Parents want screen-free STEM and schools want reading material that teaches something. Space is the one science topic every child says yes to.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>Nova finds a planet moving too slowly and has to work out what gravity is before it drifts out of the solar system.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Captain Nova, Bolt and Professor Quark appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Eight Around the Sun" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>Professor Quark answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$24</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy Little Space Explorers</a>
  </div>
</section>

<footer><div class="wrap">© Little Space Explorers. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'little-space-explorers'), 'storybook', 'The Planet That Fell Behind', 'Nova finds a planet moving too slowly and has to work out what gravity is before it drifts out of the solar system.', '# The Planet That Fell Behind

**Logline.** Nova finds a planet moving too slowly and has to work out what gravity is before it drifts out of the solar system.

**Cast.** Captain Nova — a nine-year-old commander who plans everything twice; Bolt — the ship''s repair robot, endlessly literal; Professor Quark — the mission scientist who answers with questions

## Twelve-page beat sheet

1. We meet Captain Nova doing the thing Captain Nova always does.
2. Something is not where it should be.
3. Captain Nova decides to find out why, against advice.
4. Bolt comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Professor Quark, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Bolt says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Captain Nova fixes it in a way only Captain Nova would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Captain Nova: brown-skinned girl, curly hair in a bun, patched orange spacesuit
Bolt: boxy little robot on one wheel, single blue eye, dented shoulder
Professor Quark: elderly man, wild white hair, floating clipboard

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Planet That Fell Behind" for children aged 5-9, curious about how things work.

Logline: Nova finds a planet moving too slowly and has to work out what gravity is before it drifts out of the solar system.

Cast, drawn identically on every page:
Captain Nova: brown-skinned girl, curly hair in a bun, patched orange spacesuit
Bolt: boxy little robot on one wheel, single blue eye, dented shoulder
Professor Quark: elderly man, wild white hair, floating clipboard

Follow this beat sheet, one page per beat:
1. We meet Captain Nova doing the thing Captain Nova always does.
2. Something is not where it should be.
3. Captain Nova decides to find out why, against advice.
4. Bolt comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Professor Quark, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Bolt says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Captain Nova fixes it in a way only Captain Nova would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 5-9, curious about how things work","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'little-space-explorers'), 'storybook', 'Bolt Loses Gravity', 'A broken gravity ring sends the crew floating, and Bolt must explain mass, weight and thrust while chasing his own toolbox.', '# Bolt Loses Gravity

**Logline.** A broken gravity ring sends the crew floating, and Bolt must explain mass, weight and thrust while chasing his own toolbox.

**Cast.** Captain Nova — a nine-year-old commander who plans everything twice; Bolt — the ship''s repair robot, endlessly literal; Professor Quark — the mission scientist who answers with questions

## Twelve-page beat sheet

1. We meet Captain Nova doing the thing Captain Nova always does.
2. Something is not where it should be.
3. Captain Nova decides to find out why, against advice.
4. Bolt comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Professor Quark, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Bolt says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Captain Nova fixes it in a way only Captain Nova would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Captain Nova: brown-skinned girl, curly hair in a bun, patched orange spacesuit
Bolt: boxy little robot on one wheel, single blue eye, dented shoulder
Professor Quark: elderly man, wild white hair, floating clipboard

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "Bolt Loses Gravity" for children aged 5-9, curious about how things work.

Logline: A broken gravity ring sends the crew floating, and Bolt must explain mass, weight and thrust while chasing his own toolbox.

Cast, drawn identically on every page:
Captain Nova: brown-skinned girl, curly hair in a bun, patched orange spacesuit
Bolt: boxy little robot on one wheel, single blue eye, dented shoulder
Professor Quark: elderly man, wild white hair, floating clipboard

Follow this beat sheet, one page per beat:
1. We meet Captain Nova doing the thing Captain Nova always does.
2. Something is not where it should be.
3. Captain Nova decides to find out why, against advice.
4. Bolt comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Professor Quark, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Bolt says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Captain Nova fixes it in a way only Captain Nova would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 5-9, curious about how things work","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'little-space-explorers'), 'video', 'Little Space Explorers — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# Little Space Explorers — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "Nova finds a planet moving too slowly and has to work out what gravity is before it drifts out of the solar system…"
On screen: Captain Nova, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Captain Nova and the world in two sentences. No backstory.
Visual: wide establishing shot, Captain Nova small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Bolt reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: Professor Quark asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New little space explorers story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. brown-skinned girl, curly hair in a bun, patched orange spacesuit, wide establishing shot, golden hour, soft 3D Pixar style
2. Captain Nova noticing the problem, close-up, worried expression, same style
3. boxy little robot on one wheel, single blue eye, dented shoulder, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "Little Space Explorers".

Audience: Children aged 5-9, curious about how things work
Premise: Nova finds a planet moving too slowly and has to work out what gravity is before it drifts out of the solar system.

Characters, identical in every scene:
Captain Nova: brown-skinned girl, curly hair in a bun, patched orange spacesuit
Bolt: boxy little robot on one wheel, single blue eye, dented shoulder
Professor Quark: elderly man, wild white hair, floating clipboard

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'little-space-explorers'), 'rhyme', 'Eight Around the Sun', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Eight Around the Sun

Mercury runs the quickest race,
Venus glows through cloudy lace,
Earth is home and Mars is red,
Jupiter storms above our head.

Saturn wears her golden rings,
Uranus tilts and sideways spins,
Neptune hides in windy blue —
Eight around the sun, and one is you.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
Mercury runs the quickest race,
Venus glows through cloudy lace,
Earth is home and Mars is red,
Jupiter storms above our head.

Saturn wears her golden rings,
Uranus tilts and sideways spins,
Neptune hides in windy blue —
Eight around the sun, and one is you.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Captain Nova: brown-skinned girl, curly hair in a bun, patched orange spacesuit
Bolt: boxy little robot on one wheel, single blue eye, dented shoulder
Professor Quark: elderly man, wild white hair, floating clipboard
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'little-space-explorers'), 'printable', 'Little Space Explorers printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# Little Space Explorers printable pack

1. The eight planets in order, unlabelled, for colouring
2. Captain Nova in her spacesuit
3. Bolt the repair robot with his toolbox
4. A rocket-parts labelling worksheet

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
The eight planets in order, unlabelled, for colouring

Characters if shown: Captain Nova: brown-skinned girl, curly hair in a bun, patched orange spacesuit
Bolt: boxy little robot on one wheel, single blue eye, dented shoulder
Professor Quark: elderly man, wild white hair, floating clipboard', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'little-space-explorers'), 'tutor', 'Professor Quark — AI tutor', 'An in-character tutor who answers questions about space, planets, gravity and how spacecraft work.', '# Professor Quark — AI tutor

## System prompt

You are Professor Quark, the mission scientist who answers with questions.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Professor Quark.
- Never discuss anything frightening, adult or unsafe. Redirect gently to space, planets, gravity and how spacecraft work.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Professor Quark, a friendly character who teaches children about space, planets, gravity and how spacecraft work.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Professor Quark","subject":"space, planets, gravity and how spacecraft work"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'little-space-explorers'), 'blog', 'How to Answer "Why Is the Sky Dark in Space?" Without Losing Them', 'A finished article for the site, written to be found in search.', '# How to Answer "Why Is the Sky Dark in Space?" Without Losing Them

Parents want screen-free STEM and schools want reading material that teaches something. Space is the one science topic every child says yes to.

## Children ask science questions in one sentence and expect an answer in one sentence

Children ask science questions in one sentence and expect an answer in one sentence — long explanations end the conversation.

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

Anchor every answer to something in the room: a torch, a ball, a jug of water.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

It is fine to say "nobody knows yet". That answer is the reason some children become scientists.

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. The Planet That Fell Behind works well because nova finds a planet moving too slowly and has to work out what gravity is before… and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*Little Space Explorers is a complete collection of stories, videos, rhymes and printables for
children aged 5-9, curious about how things work.*', null, null, '{"words":620,"keywords":["space books for kids","STEM story books","planets for children"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'little-space-explorers'), 'listing', 'Little Space Explorers — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — Little Space Explorers

## Amazon KDP

**Title.** The Planet That Fell Behind
**Subtitle.** Space science disguised as an adventure — a Little Space Explorers story for children aged 5-9, curious about how things work

**Description.**
Nova finds a planet moving too slowly and has to work out what gravity is before it drifts out of the solar system.

Meet Captain Nova, Bolt, Professor Quark — the cast of Little Space Explorers, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 5-9, curious about how things work
- Part of the Little Space Explorers series

**Seven keywords.** space books for kids, STEM story books, planets for children, astronaut story, science books age 6, little space explorers

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $10.99 paperback / $3.99 Kindle

---

## Etsy

**Title.** Little Space Explorers Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from Little Space Explorers. Space science disguised as an adventure.

WHAT YOU GET
• The eight planets in order, unlabelled, for colouring
• Captain Nova in her spacesuit
• Bolt the repair robot with his toolbox
• A rocket-parts labelling worksheet

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** space books for kids, STEM story books, planets for children, astronaut story, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $14

---

## Gumroad

**Product name.** Little Space Explorers — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
Little Space Explorers range, with commercial rights.

**Description.**
Parents want screen-free STEM and schools want reading material that teaches something. Space is the one science topic every child says yes to.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $24

---

## YouTube

**Title.** The Planet That Fell Behind | Little Space Explorers Episode 1
**Short title.** Eight Around the Sun 🎵 | Little Space Explorers

**Description.**
Nova finds a planet moving too slowly and has to work out what gravity is before it drifts out of the solar system.

Subscribe for a new little space explorers story every week.

00:00 The Planet That
00:05 The story begins
01:15 How it ends

**Tags.** space books for kids, STEM story books, planets for children, astronaut story, science books age 6, kids story, story time, read aloud
**Thumbnail.** Captain Nova centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90),
  ((select id from public.dfy_niches where slug = 'dino-discovery-club'), 'website', 'Dino Discovery Club — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dino Discovery Club — Dinosaurs, facts first, adventure second</title>
<meta name="description" content="Dinosaurs, facts first, adventure second. Children aged 4-8 in the dinosaur phase.">
<style>
  :root { --from: #f59e0b; --to: #84cc16; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">🦕</div>
    <h1>Dino Discovery Club</h1>
    <p>Dinosaurs, facts first, adventure second — written for children aged 4-8 in the dinosaur phase.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Almost every child goes through a dinosaur phase, and during it they will consume anything with a dinosaur on the cover. It is the most reliable evergreen niche in kids publishing.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>Rilla measures a footprint that should not exist and the club has to work out which dinosaur made it — and whether it is still nearby.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Rilla, Spike and Dr Fern appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Stomp, Stomp, Triceratops" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>Dr Fern answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$22</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy Dino Discovery Club</a>
  </div>
</section>

<footer><div class="wrap">© Dino Discovery Club. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'dino-discovery-club'), 'storybook', 'The Footprint That Was Too Big', 'Rilla measures a footprint that should not exist and the club has to work out which dinosaur made it — and whether it is still nearby.', '# The Footprint That Was Too Big

**Logline.** Rilla measures a footprint that should not exist and the club has to work out which dinosaur made it — and whether it is still nearby.

**Cast.** Rilla — a young Triceratops who measures everything; Spike — a nervous Stegosaurus with an excellent memory; Dr Fern — the club''s palaeontologist, always covered in dust

## Twelve-page beat sheet

1. We meet Rilla doing the thing Rilla always does.
2. Something is not where it should be.
3. Rilla decides to find out why, against advice.
4. Spike comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Dr Fern, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Spike says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Rilla fixes it in a way only Rilla would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Rilla: small triceratops, olive green, three stubby horns, satchel of chalk
Spike: stegosaurus, dusty blue plates, worried eyebrows
Dr Fern: woman in her fifties, wide hat, boots, brush in her back pocket

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Footprint That Was Too Big" for children aged 4-8 in the dinosaur phase.

Logline: Rilla measures a footprint that should not exist and the club has to work out which dinosaur made it — and whether it is still nearby.

Cast, drawn identically on every page:
Rilla: small triceratops, olive green, three stubby horns, satchel of chalk
Spike: stegosaurus, dusty blue plates, worried eyebrows
Dr Fern: woman in her fifties, wide hat, boots, brush in her back pocket

Follow this beat sheet, one page per beat:
1. We meet Rilla doing the thing Rilla always does.
2. Something is not where it should be.
3. Rilla decides to find out why, against advice.
4. Spike comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Dr Fern, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Spike says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Rilla fixes it in a way only Rilla would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 4-8 in the dinosaur phase","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'dino-discovery-club'), 'storybook', 'Spike Forgets How to Roar', 'A lost roar sends the club through every dinosaur sound they know, learning why each species called out in the first place.', '# Spike Forgets How to Roar

**Logline.** A lost roar sends the club through every dinosaur sound they know, learning why each species called out in the first place.

**Cast.** Rilla — a young Triceratops who measures everything; Spike — a nervous Stegosaurus with an excellent memory; Dr Fern — the club''s palaeontologist, always covered in dust

## Twelve-page beat sheet

1. We meet Rilla doing the thing Rilla always does.
2. Something is not where it should be.
3. Rilla decides to find out why, against advice.
4. Spike comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Dr Fern, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Spike says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Rilla fixes it in a way only Rilla would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Rilla: small triceratops, olive green, three stubby horns, satchel of chalk
Spike: stegosaurus, dusty blue plates, worried eyebrows
Dr Fern: woman in her fifties, wide hat, boots, brush in her back pocket

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "Spike Forgets How to Roar" for children aged 4-8 in the dinosaur phase.

Logline: A lost roar sends the club through every dinosaur sound they know, learning why each species called out in the first place.

Cast, drawn identically on every page:
Rilla: small triceratops, olive green, three stubby horns, satchel of chalk
Spike: stegosaurus, dusty blue plates, worried eyebrows
Dr Fern: woman in her fifties, wide hat, boots, brush in her back pocket

Follow this beat sheet, one page per beat:
1. We meet Rilla doing the thing Rilla always does.
2. Something is not where it should be.
3. Rilla decides to find out why, against advice.
4. Spike comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Dr Fern, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Spike says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Rilla fixes it in a way only Rilla would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 4-8 in the dinosaur phase","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'dino-discovery-club'), 'video', 'Dino Discovery Club — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# Dino Discovery Club — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "Rilla measures a footprint that should not exist and the club has to work out which dinosaur made it — and whether it is still nearby…"
On screen: Rilla, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Rilla and the world in two sentences. No backstory.
Visual: wide establishing shot, Rilla small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Spike reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: Dr Fern asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New dino discovery club story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. small triceratops, olive green, three stubby horns, satchel of chalk, wide establishing shot, golden hour, soft 3D Pixar style
2. Rilla noticing the problem, close-up, worried expression, same style
3. stegosaurus, dusty blue plates, worried eyebrows, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "Dino Discovery Club".

Audience: Children aged 4-8 in the dinosaur phase
Premise: Rilla measures a footprint that should not exist and the club has to work out which dinosaur made it — and whether it is still nearby.

Characters, identical in every scene:
Rilla: small triceratops, olive green, three stubby horns, satchel of chalk
Spike: stegosaurus, dusty blue plates, worried eyebrows
Dr Fern: woman in her fifties, wide hat, boots, brush in her back pocket

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'dino-discovery-club'), 'rhyme', 'Stomp, Stomp, Triceratops', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Stomp, Stomp, Triceratops

Stomp, stomp, Triceratops, three horns on your face,
Munching on the ferns and flowers all around the place.
Swish, swish, Stegosaurus, plates along your back,
Thump your spiky tail and keep the hungry ones back.

Roar, roar, T-rex, teeth as long as me,
Tiny little arms that cannot reach a tree.
Long, long Brachio, neck up in the sky —
Say goodnight, dinosaurs, the moon is going by.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
Stomp, stomp, Triceratops, three horns on your face,
Munching on the ferns and flowers all around the place.
Swish, swish, Stegosaurus, plates along your back,
Thump your spiky tail and keep the hungry ones back.

Roar, roar, T-rex, teeth as long as me,
Tiny little arms that cannot reach a tree.
Long, long Brachio, neck up in the sky —
Say goodnight, dinosaurs, the moon is going by.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Rilla: small triceratops, olive green, three stubby horns, satchel of chalk
Spike: stegosaurus, dusty blue plates, worried eyebrows
Dr Fern: woman in her fifties, wide hat, boots, brush in her back pocket
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'dino-discovery-club'), 'printable', 'Dino Discovery Club printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# Dino Discovery Club printable pack

1. Rilla the Triceratops among ferns
2. A dinosaur footprint measuring worksheet
3. Six dinosaurs to match to their names
4. A fossil dig scene to colour

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
Rilla the Triceratops among ferns

Characters if shown: Rilla: small triceratops, olive green, three stubby horns, satchel of chalk
Spike: stegosaurus, dusty blue plates, worried eyebrows
Dr Fern: woman in her fifties, wide hat, boots, brush in her back pocket', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'dino-discovery-club'), 'tutor', 'Dr Fern — AI tutor', 'An in-character tutor who answers questions about dinosaurs, fossils and how scientists know what they know.', '# Dr Fern — AI tutor

## System prompt

You are Dr Fern, the club''s palaeontologist, always covered in dust.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Dr Fern.
- Never discuss anything frightening, adult or unsafe. Redirect gently to dinosaurs, fossils and how scientists know what they know.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Dr Fern, a friendly character who teaches children about dinosaurs, fossils and how scientists know what they know.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Dr Fern","subject":"dinosaurs, fossils and how scientists know what they know"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'dino-discovery-club'), 'blog', 'What the Dinosaur Phase Is Actually Teaching Your Child', 'A finished article for the site, written to be found in search.', '# What the Dinosaur Phase Is Actually Teaching Your Child

Almost every child goes through a dinosaur phase, and during it they will consume anything with a dinosaur on the cover. It is the most reliable evergreen niche in kids publishing.

## Memorising forty dinosaur names is a child''s first experience of becoming an expert in something adults are not

Memorising forty dinosaur names is a child''s first experience of becoming an expert in something adults are not.

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

Dinosaurs are the gentlest possible introduction to deep time, extinction and evidence.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

Let them correct you. Being right in front of a grown-up is most of the appeal.

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. The Footprint That Was Too Big works well because rilla measures a footprint that should not exist and the club has to work out wh… and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*Dino Discovery Club is a complete collection of stories, videos, rhymes and printables for
children aged 4-8 in the dinosaur phase.*', null, null, '{"words":620,"keywords":["dinosaur books for kids","dinosaur facts children","T-rex story book"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'dino-discovery-club'), 'listing', 'Dino Discovery Club — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — Dino Discovery Club

## Amazon KDP

**Title.** The Footprint That Was Too Big
**Subtitle.** Dinosaurs, facts first, adventure second — a Dino Discovery Club story for children aged 4-8 in the dinosaur phase

**Description.**
Rilla measures a footprint that should not exist and the club has to work out which dinosaur made it — and whether it is still nearby.

Meet Rilla, Spike, Dr Fern — the cast of Dino Discovery Club, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 4-8 in the dinosaur phase
- Part of the Dino Discovery Club series

**Seven keywords.** dinosaur books for kids, dinosaur facts children, T-rex story book, paleontology for kids, dinosaur colouring book, dino discovery club

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $9.99 paperback / $3.49 Kindle

---

## Etsy

**Title.** Dino Discovery Club Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from Dino Discovery Club. Dinosaurs, facts first, adventure second.

WHAT YOU GET
• Rilla the Triceratops among ferns
• A dinosaur footprint measuring worksheet
• Six dinosaurs to match to their names
• A fossil dig scene to colour

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** dinosaur books for kids, dinosaur facts children, T-rex story book, paleontology for kids, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $13

---

## Gumroad

**Product name.** Dino Discovery Club — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
Dino Discovery Club range, with commercial rights.

**Description.**
Almost every child goes through a dinosaur phase, and during it they will consume anything with a dinosaur on the cover. It is the most reliable evergreen niche in kids publishing.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $22

---

## YouTube

**Title.** The Footprint That Was Too Big | Dino Discovery Club Episode 1
**Short title.** Stomp, Stomp, Triceratops 🎵 | Dino Discovery Club

**Description.**
Rilla measures a footprint that should not exist and the club has to work out which dinosaur made it — and whether it is still nearby.

Subscribe for a new dino discovery club story every week.

00:00 The Footprint That
00:05 The story begins
01:15 How it ends

**Tags.** dinosaur books for kids, dinosaur facts children, T-rex story book, paleontology for kids, dinosaur colouring book, kids story, story time, read aloud
**Thumbnail.** Rilla centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90),
  ((select id from public.dfy_niches where slug = 'ocean-friends-academy'), 'website', 'Ocean Friends Academy — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ocean Friends Academy — Sea life, friendship and looking after the water</title>
<meta name="description" content="Sea life, friendship and looking after the water. Children aged 3-7 who love animals.">
<style>
  :root { --from: #06b6d4; --to: #3b82f6; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">🐙</div>
    <h1>Ocean Friends Academy</h1>
    <p>Sea life, friendship and looking after the water — written for children aged 3-7 who love animals.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Ocean themes sell year-round to parents, nurseries and gift buyers, and carry an environmental message schools actively look for.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>When the reef turns grey, Ollie and Fin follow the warm water to find out why, and bring back something everyone can do about it.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Ollie, Marina and Fin appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Down Where the Water Sings" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>Fin answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$20</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy Ocean Friends Academy</a>
  </div>
</section>

<footer><div class="wrap">© Ocean Friends Academy. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'ocean-friends-academy'), 'storybook', 'The Reef That Lost Its Colour', 'When the reef turns grey, Ollie and Fin follow the warm water to find out why, and bring back something everyone can do about it.', '# The Reef That Lost Its Colour

**Logline.** When the reef turns grey, Ollie and Fin follow the warm water to find out why, and bring back something everyone can do about it.

**Cast.** Ollie — an octopus who solves problems with all eight arms at once; Marina — a sea turtle who has seen the whole ocean twice; Fin — a clownfish who talks first and thinks later

## Twelve-page beat sheet

1. We meet Ollie doing the thing Ollie always does.
2. Something is not where it should be.
3. Ollie decides to find out why, against advice.
4. Marina comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Fin, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Marina says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Ollie fixes it in a way only Ollie would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Ollie: small purple octopus, one arm always holding something
Marina: old green sea turtle, barnacled shell, patient eyes
Fin: orange clownfish, oversized fins, permanently mid-sentence

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Reef That Lost Its Colour" for children aged 3-7 who love animals.

Logline: When the reef turns grey, Ollie and Fin follow the warm water to find out why, and bring back something everyone can do about it.

Cast, drawn identically on every page:
Ollie: small purple octopus, one arm always holding something
Marina: old green sea turtle, barnacled shell, patient eyes
Fin: orange clownfish, oversized fins, permanently mid-sentence

Follow this beat sheet, one page per beat:
1. We meet Ollie doing the thing Ollie always does.
2. Something is not where it should be.
3. Ollie decides to find out why, against advice.
4. Marina comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Fin, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Marina says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Ollie fixes it in a way only Ollie would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 3-7 who love animals","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'ocean-friends-academy'), 'storybook', 'Marina''s Long Way Home', 'A turtle who has crossed an ocean teaches a nervous clownfish that being lost and being brave can happen at the same time.', '# Marina''s Long Way Home

**Logline.** A turtle who has crossed an ocean teaches a nervous clownfish that being lost and being brave can happen at the same time.

**Cast.** Ollie — an octopus who solves problems with all eight arms at once; Marina — a sea turtle who has seen the whole ocean twice; Fin — a clownfish who talks first and thinks later

## Twelve-page beat sheet

1. We meet Ollie doing the thing Ollie always does.
2. Something is not where it should be.
3. Ollie decides to find out why, against advice.
4. Marina comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Fin, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Marina says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Ollie fixes it in a way only Ollie would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Ollie: small purple octopus, one arm always holding something
Marina: old green sea turtle, barnacled shell, patient eyes
Fin: orange clownfish, oversized fins, permanently mid-sentence

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "Marina''s Long Way Home" for children aged 3-7 who love animals.

Logline: A turtle who has crossed an ocean teaches a nervous clownfish that being lost and being brave can happen at the same time.

Cast, drawn identically on every page:
Ollie: small purple octopus, one arm always holding something
Marina: old green sea turtle, barnacled shell, patient eyes
Fin: orange clownfish, oversized fins, permanently mid-sentence

Follow this beat sheet, one page per beat:
1. We meet Ollie doing the thing Ollie always does.
2. Something is not where it should be.
3. Ollie decides to find out why, against advice.
4. Marina comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Fin, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Marina says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Ollie fixes it in a way only Ollie would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 3-7 who love animals","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'ocean-friends-academy'), 'video', 'Ocean Friends Academy — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# Ocean Friends Academy — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "When the reef turns grey, Ollie and Fin follow the warm water to find out why, and bring back something everyone can do about it…"
On screen: Ollie, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Ollie and the world in two sentences. No backstory.
Visual: wide establishing shot, Ollie small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Marina reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: Fin asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New ocean friends academy story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. small purple octopus, one arm always holding something, wide establishing shot, golden hour, soft 3D Pixar style
2. Ollie noticing the problem, close-up, worried expression, same style
3. old green sea turtle, barnacled shell, patient eyes, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "Ocean Friends Academy".

Audience: Children aged 3-7 who love animals
Premise: When the reef turns grey, Ollie and Fin follow the warm water to find out why, and bring back something everyone can do about it.

Characters, identical in every scene:
Ollie: small purple octopus, one arm always holding something
Marina: old green sea turtle, barnacled shell, patient eyes
Fin: orange clownfish, oversized fins, permanently mid-sentence

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'ocean-friends-academy'), 'rhyme', 'Down Where the Water Sings', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Down Where the Water Sings

Down where the water sings and sways,
Eight arms wave in eight small ways.
A turtle glides, a clownfish darts,
The whole reef beats like a hundred hearts.

Keep it blue and keep it clean,
Keep the water in between.
Every drop that leaves the shore
Comes back to us, and one drop more.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
Down where the water sings and sways,
Eight arms wave in eight small ways.
A turtle glides, a clownfish darts,
The whole reef beats like a hundred hearts.

Keep it blue and keep it clean,
Keep the water in between.
Every drop that leaves the shore
Comes back to us, and one drop more.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Ollie: small purple octopus, one arm always holding something
Marina: old green sea turtle, barnacled shell, patient eyes
Fin: orange clownfish, oversized fins, permanently mid-sentence
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'ocean-friends-academy'), 'printable', 'Ocean Friends Academy printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# Ocean Friends Academy printable pack

1. Ollie the octopus with eight patterned arms
2. A coral reef scene with ten creatures to find
3. Marina the sea turtle
4. A beach clean-up checklist for children

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
Ollie the octopus with eight patterned arms

Characters if shown: Ollie: small purple octopus, one arm always holding something
Marina: old green sea turtle, barnacled shell, patient eyes
Fin: orange clownfish, oversized fins, permanently mid-sentence', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'ocean-friends-academy'), 'tutor', 'Marina — AI tutor', 'An in-character tutor who answers questions about ocean animals, how the sea works and how to look after it.', '# Marina — AI tutor

## System prompt

You are Marina, a sea turtle who has seen the whole ocean twice.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Marina.
- Never discuss anything frightening, adult or unsafe. Redirect gently to ocean animals, how the sea works and how to look after it.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Marina, a friendly character who teaches children about ocean animals, how the sea works and how to look after it.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Marina","subject":"ocean animals, how the sea works and how to look after it"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'ocean-friends-academy'), 'blog', 'Teaching Children About the Ocean Without Frightening Them', 'A finished article for the site, written to be found in search.', '# Teaching Children About the Ocean Without Frightening Them

Ocean themes sell year-round to parents, nurseries and gift buyers, and carry an environmental message schools actively look for.

## Under-sevens cannot act on a problem the size of a planet

Under-sevens cannot act on a problem the size of a planet — give them one they can act on, like a single beach.

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

Lead with wonder and mention the threat second; a child who loves the ocean will protect it later.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

Concrete numbers land better than adjectives: an octopus has three hearts, not "amazing hearts".

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. The Reef That Lost Its Colour works well because when the reef turns grey, ollie and fin follow the warm water to find out why, a… and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*Ocean Friends Academy is a complete collection of stories, videos, rhymes and printables for
children aged 3-7 who love animals.*', null, null, '{"words":620,"keywords":["ocean books for kids","sea animals children","under the sea story"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'ocean-friends-academy'), 'listing', 'Ocean Friends Academy — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — Ocean Friends Academy

## Amazon KDP

**Title.** The Reef That Lost Its Colour
**Subtitle.** Sea life, friendship and looking after the water — a Ocean Friends Academy story for children aged 3-7 who love animals

**Description.**
When the reef turns grey, Ollie and Fin follow the warm water to find out why, and bring back something everyone can do about it.

Meet Ollie, Marina, Fin — the cast of Ocean Friends Academy, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 3-7 who love animals
- Part of the Ocean Friends Academy series

**Seven keywords.** ocean books for kids, sea animals children, under the sea story, ocean conservation kids, marine life book, ocean friends academy

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $9.49 paperback / $2.99 Kindle

---

## Etsy

**Title.** Ocean Friends Academy Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from Ocean Friends Academy. Sea life, friendship and looking after the water.

WHAT YOU GET
• Ollie the octopus with eight patterned arms
• A coral reef scene with ten creatures to find
• Marina the sea turtle
• A beach clean-up checklist for children

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** ocean books for kids, sea animals children, under the sea story, ocean conservation kids, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $12

---

## Gumroad

**Product name.** Ocean Friends Academy — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
Ocean Friends Academy range, with commercial rights.

**Description.**
Ocean themes sell year-round to parents, nurseries and gift buyers, and carry an environmental message schools actively look for.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $20

---

## YouTube

**Title.** The Reef That Lost Its Colour | Ocean Friends Academy Episode 1
**Short title.** Down Where the Water Sings 🎵 | Ocean Friends Academy

**Description.**
When the reef turns grey, Ollie and Fin follow the warm water to find out why, and bring back something everyone can do about it.

Subscribe for a new ocean friends academy story every week.

00:00 The Reef That
00:05 The story begins
01:15 How it ends

**Tags.** ocean books for kids, sea animals children, under the sea story, ocean conservation kids, marine life book, kids story, story time, read aloud
**Thumbnail.** Ollie centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90),
  ((select id from public.dfy_niches where slug = 'tiny-superheroes'), 'website', 'Tiny Superheroes — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tiny Superheroes — Everyday courage, cape optional</title>
<meta name="description" content="Everyday courage, cape optional. Children aged 5-9 who want to be the hero.">
<style>
  :root { --from: #ef4444; --to: #f59e0b; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">🦸</div>
    <h1>Tiny Superheroes</h1>
    <p>Everyday courage, cape optional — written for children aged 5-9 who want to be the hero.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Superhero content sells itself, but parents want the values without the violence. This pack is the version they are looking for and rarely find.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>The Grumble grows every time somebody shouts, so Kit defeats it by being the only person in town who stays calm.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Kit, Boomer and The Grumble appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Powers I Already Have" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>The Grumble answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$24</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy Tiny Superheroes</a>
  </div>
</section>

<footer><div class="wrap">© Tiny Superheroes. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'tiny-superheroes'), 'storybook', 'The Day Kit Did Nothing', 'The Grumble grows every time somebody shouts, so Kit defeats it by being the only person in town who stays calm.', '# The Day Kit Did Nothing

**Logline.** The Grumble grows every time somebody shouts, so Kit defeats it by being the only person in town who stays calm.

**Cast.** Kit — the smallest hero, whose power is noticing; Boomer — strong and loud, learning that helping is quiet work; The Grumble — a shadow made of everybody''s bad mood

## Twelve-page beat sheet

1. We meet Kit doing the thing Kit always does.
2. Something is not where it should be.
3. Kit decides to find out why, against advice.
4. Boomer comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet The Grumble, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Boomer says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Kit fixes it in a way only Kit would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Kit: seven-year-old, yellow raincoat as a cape, scuffed trainers
Boomer: tall boy, red gloves, permanently grinning
The Grumble: shifting grey blob with too many eyebrows

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Day Kit Did Nothing" for children aged 5-9 who want to be the hero.

Logline: The Grumble grows every time somebody shouts, so Kit defeats it by being the only person in town who stays calm.

Cast, drawn identically on every page:
Kit: seven-year-old, yellow raincoat as a cape, scuffed trainers
Boomer: tall boy, red gloves, permanently grinning
The Grumble: shifting grey blob with too many eyebrows

Follow this beat sheet, one page per beat:
1. We meet Kit doing the thing Kit always does.
2. Something is not where it should be.
3. Kit decides to find out why, against advice.
4. Boomer comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet The Grumble, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Boomer says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Kit fixes it in a way only Kit would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 5-9 who want to be the hero","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'tiny-superheroes'), 'storybook', 'Boomer Breaks the Bridge', 'The strongest hero in town accidentally makes everything worse, and has to learn that saying sorry is the harder power.', '# Boomer Breaks the Bridge

**Logline.** The strongest hero in town accidentally makes everything worse, and has to learn that saying sorry is the harder power.

**Cast.** Kit — the smallest hero, whose power is noticing; Boomer — strong and loud, learning that helping is quiet work; The Grumble — a shadow made of everybody''s bad mood

## Twelve-page beat sheet

1. We meet Kit doing the thing Kit always does.
2. Something is not where it should be.
3. Kit decides to find out why, against advice.
4. Boomer comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet The Grumble, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Boomer says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Kit fixes it in a way only Kit would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Kit: seven-year-old, yellow raincoat as a cape, scuffed trainers
Boomer: tall boy, red gloves, permanently grinning
The Grumble: shifting grey blob with too many eyebrows

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "Boomer Breaks the Bridge" for children aged 5-9 who want to be the hero.

Logline: The strongest hero in town accidentally makes everything worse, and has to learn that saying sorry is the harder power.

Cast, drawn identically on every page:
Kit: seven-year-old, yellow raincoat as a cape, scuffed trainers
Boomer: tall boy, red gloves, permanently grinning
The Grumble: shifting grey blob with too many eyebrows

Follow this beat sheet, one page per beat:
1. We meet Kit doing the thing Kit always does.
2. Something is not where it should be.
3. Kit decides to find out why, against advice.
4. Boomer comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet The Grumble, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Boomer says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Kit fixes it in a way only Kit would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 5-9 who want to be the hero","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'tiny-superheroes'), 'video', 'Tiny Superheroes — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# Tiny Superheroes — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "The Grumble grows every time somebody shouts, so Kit defeats it by being the only person in town who stays calm…"
On screen: Kit, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Kit and the world in two sentences. No backstory.
Visual: wide establishing shot, Kit small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Boomer reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: The Grumble asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New tiny superheroes story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. seven-year-old, yellow raincoat as a cape, scuffed trainers, wide establishing shot, golden hour, soft 3D Pixar style
2. Kit noticing the problem, close-up, worried expression, same style
3. tall boy, red gloves, permanently grinning, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "Tiny Superheroes".

Audience: Children aged 5-9 who want to be the hero
Premise: The Grumble grows every time somebody shouts, so Kit defeats it by being the only person in town who stays calm.

Characters, identical in every scene:
Kit: seven-year-old, yellow raincoat as a cape, scuffed trainers
Boomer: tall boy, red gloves, permanently grinning
The Grumble: shifting grey blob with too many eyebrows

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'tiny-superheroes'), 'rhyme', 'Powers I Already Have', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Powers I Already Have

I cannot fly and I cannot freeze,
I cannot lift a house with ease.
But I can notice when you are sad,
And I can share the last I had.

I can wait, I can be kind,
I can change my stubborn mind.
No cape, no mask, no secret name —
And still a hero, just the same.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
I cannot fly and I cannot freeze,
I cannot lift a house with ease.
But I can notice when you are sad,
And I can share the last I had.

I can wait, I can be kind,
I can change my stubborn mind.
No cape, no mask, no secret name —
And still a hero, just the same.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Kit: seven-year-old, yellow raincoat as a cape, scuffed trainers
Boomer: tall boy, red gloves, permanently grinning
The Grumble: shifting grey blob with too many eyebrows
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'tiny-superheroes'), 'printable', 'Tiny Superheroes printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# Tiny Superheroes printable pack

1. Kit in her raincoat cape
2. Design-your-own superhero badge template
3. The Grumble getting smaller in four panels
4. A "powers I already have" fill-in poster

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
Kit in her raincoat cape

Characters if shown: Kit: seven-year-old, yellow raincoat as a cape, scuffed trainers
Boomer: tall boy, red gloves, permanently grinning
The Grumble: shifting grey blob with too many eyebrows', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'tiny-superheroes'), 'tutor', 'Kit — AI tutor', 'An in-character tutor who answers questions about big feelings, courage, apologising and standing up for people.', '# Kit — AI tutor

## System prompt

You are Kit, the smallest hero, whose power is noticing.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Kit.
- Never discuss anything frightening, adult or unsafe. Redirect gently to big feelings, courage, apologising and standing up for people.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Kit, a friendly character who teaches children about big feelings, courage, apologising and standing up for people.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Kit","subject":"big feelings, courage, apologising and standing up for people"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'tiny-superheroes'), 'blog', 'The Superhero Stories That Actually Build Character', 'A finished article for the site, written to be found in search.', '# The Superhero Stories That Actually Build Character

Superhero content sells itself, but parents want the values without the violence. This pack is the version they are looking for and rarely find.

## Children copy what the hero does under pressure, not what the narrator says about them

Children copy what the hero does under pressure, not what the narrator says about them.

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

A hero who fails and repairs it teaches more than one who never fails.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

Give the villain a reason. "He was having a terrible day" is a lesson; "he is evil" is not.

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. The Day Kit Did Nothing works well because the grumble grows every time somebody shouts, so kit defeats it by being the onl… and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*Tiny Superheroes is a complete collection of stories, videos, rhymes and printables for
children aged 5-9 who want to be the hero.*', null, null, '{"words":620,"keywords":["superhero books for kids","kids courage story","social emotional learning book"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'tiny-superheroes'), 'listing', 'Tiny Superheroes — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — Tiny Superheroes

## Amazon KDP

**Title.** The Day Kit Did Nothing
**Subtitle.** Everyday courage, cape optional — a Tiny Superheroes story for children aged 5-9 who want to be the hero

**Description.**
The Grumble grows every time somebody shouts, so Kit defeats it by being the only person in town who stays calm.

Meet Kit, Boomer, The Grumble — the cast of Tiny Superheroes, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 5-9 who want to be the hero
- Part of the Tiny Superheroes series

**Seven keywords.** superhero books for kids, kids courage story, social emotional learning book, brave kids book, superhero colouring, tiny superheroes

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $10.49 paperback / $3.49 Kindle

---

## Etsy

**Title.** Tiny Superheroes Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from Tiny Superheroes. Everyday courage, cape optional.

WHAT YOU GET
• Kit in her raincoat cape
• Design-your-own superhero badge template
• The Grumble getting smaller in four panels
• A "powers I already have" fill-in poster

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** superhero books for kids, kids courage story, social emotional learning book, brave kids book, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $14

---

## Gumroad

**Product name.** Tiny Superheroes — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
Tiny Superheroes range, with commercial rights.

**Description.**
Superhero content sells itself, but parents want the values without the violence. This pack is the version they are looking for and rarely find.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $24

---

## YouTube

**Title.** The Day Kit Did Nothing | Tiny Superheroes Episode 1
**Short title.** Powers I Already Have 🎵 | Tiny Superheroes

**Description.**
The Grumble grows every time somebody shouts, so Kit defeats it by being the only person in town who stays calm.

Subscribe for a new tiny superheroes story every week.

00:00 The Day Kit
00:05 The story begins
01:15 How it ends

**Tags.** superhero books for kids, kids courage story, social emotional learning book, brave kids book, superhero colouring, kids story, story time, read aloud
**Thumbnail.** Kit centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90),
  ((select id from public.dfy_niches where slug = 'fairy-garden-adventures'), 'website', 'Fairy Garden Adventures — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fairy Garden Adventures — Tiny magic in an ordinary back garden</title>
<meta name="description" content="Tiny magic in an ordinary back garden. Children aged 4-8 who like small worlds.">
<style>
  :root { --from: #ec4899; --to: #a855f7; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">🧚</div>
    <h1>Fairy Garden Adventures</h1>
    <p>Tiny magic in an ordinary back garden — written for children aged 4-8 who like small worlds.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Fairy themes are the highest-converting category on Etsy for children''s printables, and the audience buys repeatedly rather than once.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>Thistle finds a door that has been shut for a hundred years and learns why some things are left closed.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Thistle, Bramble and Grandmother Vine appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Knock Three Times on the Toadstool Door" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>Grandmother Vine answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$25</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy Fairy Garden Adventures</a>
  </div>
</section>

<footer><div class="wrap">© Fairy Garden Adventures. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'fairy-garden-adventures'), 'storybook', 'The Door in the Apple Tree', 'Thistle finds a door that has been shut for a hundred years and learns why some things are left closed.', '# The Door in the Apple Tree

**Logline.** Thistle finds a door that has been shut for a hundred years and learns why some things are left closed.

**Cast.** Thistle — a fairy the size of a thumb who is far too brave; Bramble — a beetle who carries messages and complains about it; Grandmother Vine — the oldest plant in the garden

## Twelve-page beat sheet

1. We meet Thistle doing the thing Thistle always does.
2. Something is not where it should be.
3. Thistle decides to find out why, against advice.
4. Bramble comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Grandmother Vine, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Bramble says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Thistle fixes it in a way only Thistle would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Thistle: tiny fairy, dandelion-seed hair, dress made of a single petal
Bramble: shiny black beetle with a satchel, permanently unimpressed
Grandmother Vine: ancient climbing rose with a face in the bark

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Door in the Apple Tree" for children aged 4-8 who like small worlds.

Logline: Thistle finds a door that has been shut for a hundred years and learns why some things are left closed.

Cast, drawn identically on every page:
Thistle: tiny fairy, dandelion-seed hair, dress made of a single petal
Bramble: shiny black beetle with a satchel, permanently unimpressed
Grandmother Vine: ancient climbing rose with a face in the bark

Follow this beat sheet, one page per beat:
1. We meet Thistle doing the thing Thistle always does.
2. Something is not where it should be.
3. Thistle decides to find out why, against advice.
4. Bramble comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Grandmother Vine, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Bramble says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Thistle fixes it in a way only Thistle would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 4-8 who like small worlds","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'fairy-garden-adventures'), 'storybook', 'Bramble''s Last Delivery', 'A message that must cross the whole garden before sunset takes a grumpy beetle past every neighbour he has been avoiding.', '# Bramble''s Last Delivery

**Logline.** A message that must cross the whole garden before sunset takes a grumpy beetle past every neighbour he has been avoiding.

**Cast.** Thistle — a fairy the size of a thumb who is far too brave; Bramble — a beetle who carries messages and complains about it; Grandmother Vine — the oldest plant in the garden

## Twelve-page beat sheet

1. We meet Thistle doing the thing Thistle always does.
2. Something is not where it should be.
3. Thistle decides to find out why, against advice.
4. Bramble comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Grandmother Vine, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Bramble says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Thistle fixes it in a way only Thistle would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Thistle: tiny fairy, dandelion-seed hair, dress made of a single petal
Bramble: shiny black beetle with a satchel, permanently unimpressed
Grandmother Vine: ancient climbing rose with a face in the bark

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "Bramble''s Last Delivery" for children aged 4-8 who like small worlds.

Logline: A message that must cross the whole garden before sunset takes a grumpy beetle past every neighbour he has been avoiding.

Cast, drawn identically on every page:
Thistle: tiny fairy, dandelion-seed hair, dress made of a single petal
Bramble: shiny black beetle with a satchel, permanently unimpressed
Grandmother Vine: ancient climbing rose with a face in the bark

Follow this beat sheet, one page per beat:
1. We meet Thistle doing the thing Thistle always does.
2. Something is not where it should be.
3. Thistle decides to find out why, against advice.
4. Bramble comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Grandmother Vine, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Bramble says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Thistle fixes it in a way only Thistle would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 4-8 who like small worlds","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'fairy-garden-adventures'), 'video', 'Fairy Garden Adventures — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# Fairy Garden Adventures — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "Thistle finds a door that has been shut for a hundred years and learns why some things are left closed…"
On screen: Thistle, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Thistle and the world in two sentences. No backstory.
Visual: wide establishing shot, Thistle small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Bramble reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: Grandmother Vine asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New fairy garden adventures story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. tiny fairy, dandelion-seed hair, dress made of a single petal, wide establishing shot, golden hour, soft 3D Pixar style
2. Thistle noticing the problem, close-up, worried expression, same style
3. shiny black beetle with a satchel, permanently unimpressed, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "Fairy Garden Adventures".

Audience: Children aged 4-8 who like small worlds
Premise: Thistle finds a door that has been shut for a hundred years and learns why some things are left closed.

Characters, identical in every scene:
Thistle: tiny fairy, dandelion-seed hair, dress made of a single petal
Bramble: shiny black beetle with a satchel, permanently unimpressed
Grandmother Vine: ancient climbing rose with a face in the bark

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'fairy-garden-adventures'), 'rhyme', 'Knock Three Times on the Toadstool Door', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Knock Three Times on the Toadstool Door

Knock three times on the toadstool door,
Wipe your wings and mind the floor.
Tea in a thimble, crumbs on a leaf,
A dandelion clock says the visit is brief.

Under the ivy, over the stone,
Nobody tiny goes home alone.
Say your thank-yous, wave goodbye —
And catch the last light in the sky.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
Knock three times on the toadstool door,
Wipe your wings and mind the floor.
Tea in a thimble, crumbs on a leaf,
A dandelion clock says the visit is brief.

Under the ivy, over the stone,
Nobody tiny goes home alone.
Say your thank-yous, wave goodbye —
And catch the last light in the sky.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Thistle: tiny fairy, dandelion-seed hair, dress made of a single petal
Bramble: shiny black beetle with a satchel, permanently unimpressed
Grandmother Vine: ancient climbing rose with a face in the bark
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'fairy-garden-adventures'), 'printable', 'Fairy Garden Adventures printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# Fairy Garden Adventures printable pack

1. Thistle the fairy on a dandelion
2. A fairy door template to cut out and decorate
3. The garden map with eight hidden doors
4. A pressed-flower fairy craft sheet

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
Thistle the fairy on a dandelion

Characters if shown: Thistle: tiny fairy, dandelion-seed hair, dress made of a single petal
Bramble: shiny black beetle with a satchel, permanently unimpressed
Grandmother Vine: ancient climbing rose with a face in the bark', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'fairy-garden-adventures'), 'tutor', 'Grandmother Vine — AI tutor', 'An in-character tutor who answers questions about plants, insects, seasons and the small things in a garden.', '# Grandmother Vine — AI tutor

## System prompt

You are Grandmother Vine, the oldest plant in the garden.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Grandmother Vine.
- Never discuss anything frightening, adult or unsafe. Redirect gently to plants, insects, seasons and the small things in a garden.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Grandmother Vine, a friendly character who teaches children about plants, insects, seasons and the small things in a garden.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Grandmother Vine","subject":"plants, insects, seasons and the small things in a garden"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'fairy-garden-adventures'), 'blog', 'Build a Fairy Garden With Your Child in One Afternoon', 'A finished article for the site, written to be found in search.', '# Build a Fairy Garden With Your Child in One Afternoon

Fairy themes are the highest-converting category on Etsy for children''s printables, and the audience buys repeatedly rather than once.

## A fairy garden is a gardening lesson children volunteer for

A fairy garden is a gardening lesson children volunteer for — they water it because something lives there.

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

Use real plants, not plastic. The point is that it changes.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

Let them make the door badly. A crooked door is theirs; a perfect one is yours.

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. The Door in the Apple Tree works well because thistle finds a door that has been shut for a hundred years and learns why some … and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*Fairy Garden Adventures is a complete collection of stories, videos, rhymes and printables for
children aged 4-8 who like small worlds.*', null, null, '{"words":620,"keywords":["fairy books for kids","fairy garden printables","magical story children"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'fairy-garden-adventures'), 'listing', 'Fairy Garden Adventures — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — Fairy Garden Adventures

## Amazon KDP

**Title.** The Door in the Apple Tree
**Subtitle.** Tiny magic in an ordinary back garden — a Fairy Garden Adventures story for children aged 4-8 who like small worlds

**Description.**
Thistle finds a door that has been shut for a hundred years and learns why some things are left closed.

Meet Thistle, Bramble, Grandmother Vine — the cast of Fairy Garden Adventures, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 4-8 who like small worlds
- Part of the Fairy Garden Adventures series

**Seven keywords.** fairy books for kids, fairy garden printables, magical story children, nature fairy book, fairy colouring pages, fairy garden adventures

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $9.99 paperback / $2.99 Kindle

---

## Etsy

**Title.** Fairy Garden Adventures Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from Fairy Garden Adventures. Tiny magic in an ordinary back garden.

WHAT YOU GET
• Thistle the fairy on a dandelion
• A fairy door template to cut out and decorate
• The garden map with eight hidden doors
• A pressed-flower fairy craft sheet

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** fairy books for kids, fairy garden printables, magical story children, nature fairy book, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $15

---

## Gumroad

**Product name.** Fairy Garden Adventures — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
Fairy Garden Adventures range, with commercial rights.

**Description.**
Fairy themes are the highest-converting category on Etsy for children''s printables, and the audience buys repeatedly rather than once.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $25

---

## YouTube

**Title.** The Door in the Apple Tree | Fairy Garden Adventures Episode 1
**Short title.** Knock Three Times on the Toadstool Door 🎵 | Fairy Garden Adventures

**Description.**
Thistle finds a door that has been shut for a hundred years and learns why some things are left closed.

Subscribe for a new fairy garden adventures story every week.

00:00 The Door in
00:05 The story begins
01:15 How it ends

**Tags.** fairy books for kids, fairy garden printables, magical story children, nature fairy book, fairy colouring pages, kids story, story time, read aloud
**Thumbnail.** Thistle centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90),
  ((select id from public.dfy_niches where slug = 'kind-kids-club'), 'website', 'Kind Kids Club — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kind Kids Club — Feelings, friendship and getting it wrong</title>
<meta name="description" content="Feelings, friendship and getting it wrong. Children aged 4-8, and the adults navigating it with them.">
<style>
  :root { --from: #f97316; --to: #eab308; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">💛</div>
    <h1>Kind Kids Club</h1>
    <p>Feelings, friendship and getting it wrong — written for children aged 4-8, and the adults navigating it with them.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Social-emotional learning is on every school curriculum and every parenting bestseller list, and there is far more demand than there is good material.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>Juno says something true and unkind, and spends the day learning the difference between honest and cruel.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Juno, Sam and Ms Aria appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Big Feeling, Small Body" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>Ms Aria answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$29</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy Kind Kids Club</a>
  </div>
</section>

<footer><div class="wrap">© Kind Kids Club. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'kind-kids-club'), 'storybook', 'The Truth Juno Should Not Have Said', 'Juno says something true and unkind, and spends the day learning the difference between honest and cruel.', '# The Truth Juno Should Not Have Said

**Logline.** Juno says something true and unkind, and spends the day learning the difference between honest and cruel.

**Cast.** Juno — seven, honest to a fault, still learning tact; Sam — quiet, notices everything, says little; Ms Aria — the teacher who asks instead of telling

## Twelve-page beat sheet

1. We meet Juno doing the thing Juno always does.
2. Something is not where it should be.
3. Juno decides to find out why, against advice.
4. Sam comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Ms Aria, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Sam says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Juno fixes it in a way only Juno would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Juno: seven-year-old with box braids, dungarees, one shoelace undone
Sam: small boy, thick glasses, always drawing
Ms Aria: young teacher, bright cardigan, sits on the floor with the class

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Truth Juno Should Not Have Said" for children aged 4-8, and the adults navigating it with them.

Logline: Juno says something true and unkind, and spends the day learning the difference between honest and cruel.

Cast, drawn identically on every page:
Juno: seven-year-old with box braids, dungarees, one shoelace undone
Sam: small boy, thick glasses, always drawing
Ms Aria: young teacher, bright cardigan, sits on the floor with the class

Follow this beat sheet, one page per beat:
1. We meet Juno doing the thing Juno always does.
2. Something is not where it should be.
3. Juno decides to find out why, against advice.
4. Sam comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Ms Aria, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Sam says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Juno fixes it in a way only Juno would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 4-8, and the adults navigating it with them","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'kind-kids-club'), 'storybook', 'Sam Says Nothing', 'A boy who never speaks up is left out of the game, until his class works out that including someone is an action, not a feeling.', '# Sam Says Nothing

**Logline.** A boy who never speaks up is left out of the game, until his class works out that including someone is an action, not a feeling.

**Cast.** Juno — seven, honest to a fault, still learning tact; Sam — quiet, notices everything, says little; Ms Aria — the teacher who asks instead of telling

## Twelve-page beat sheet

1. We meet Juno doing the thing Juno always does.
2. Something is not where it should be.
3. Juno decides to find out why, against advice.
4. Sam comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Ms Aria, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Sam says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Juno fixes it in a way only Juno would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Juno: seven-year-old with box braids, dungarees, one shoelace undone
Sam: small boy, thick glasses, always drawing
Ms Aria: young teacher, bright cardigan, sits on the floor with the class

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "Sam Says Nothing" for children aged 4-8, and the adults navigating it with them.

Logline: A boy who never speaks up is left out of the game, until his class works out that including someone is an action, not a feeling.

Cast, drawn identically on every page:
Juno: seven-year-old with box braids, dungarees, one shoelace undone
Sam: small boy, thick glasses, always drawing
Ms Aria: young teacher, bright cardigan, sits on the floor with the class

Follow this beat sheet, one page per beat:
1. We meet Juno doing the thing Juno always does.
2. Something is not where it should be.
3. Juno decides to find out why, against advice.
4. Sam comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Ms Aria, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Sam says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Juno fixes it in a way only Juno would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 4-8, and the adults navigating it with them","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'kind-kids-club'), 'video', 'Kind Kids Club — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# Kind Kids Club — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "Juno says something true and unkind, and spends the day learning the difference between honest and cruel…"
On screen: Juno, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Juno and the world in two sentences. No backstory.
Visual: wide establishing shot, Juno small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Sam reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: Ms Aria asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New kind kids club story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. seven-year-old with box braids, dungarees, one shoelace undone, wide establishing shot, golden hour, soft 3D Pixar style
2. Juno noticing the problem, close-up, worried expression, same style
3. small boy, thick glasses, always drawing, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "Kind Kids Club".

Audience: Children aged 4-8, and the adults navigating it with them
Premise: Juno says something true and unkind, and spends the day learning the difference between honest and cruel.

Characters, identical in every scene:
Juno: seven-year-old with box braids, dungarees, one shoelace undone
Sam: small boy, thick glasses, always drawing
Ms Aria: young teacher, bright cardigan, sits on the floor with the class

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'kind-kids-club'), 'rhyme', 'Big Feeling, Small Body', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Big Feeling, Small Body

A big feeling in a small body,
Too much thunder for one boy.
Breathe it in for one, two, three,
Breathe it out for four and five.

Name it once and name it twice —
Angry, worried, left behind.
A feeling with a name behaves,
And soon you will not mind.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
A big feeling in a small body,
Too much thunder for one boy.
Breathe it in for one, two, three,
Breathe it out for four and five.

Name it once and name it twice —
Angry, worried, left behind.
A feeling with a name behaves,
And soon you will not mind.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Juno: seven-year-old with box braids, dungarees, one shoelace undone
Sam: small boy, thick glasses, always drawing
Ms Aria: young teacher, bright cardigan, sits on the floor with the class
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'kind-kids-club'), 'printable', 'Kind Kids Club printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# Kind Kids Club printable pack

1. A feelings wheel with twelve faces to colour
2. Juno and Sam sitting back to back
3. A "what I could say instead" comic strip to fill in
4. A calm-down corner poster

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
A feelings wheel with twelve faces to colour

Characters if shown: Juno: seven-year-old with box braids, dungarees, one shoelace undone
Sam: small boy, thick glasses, always drawing
Ms Aria: young teacher, bright cardigan, sits on the floor with the class', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'kind-kids-club'), 'tutor', 'Ms Aria — AI tutor', 'An in-character tutor who answers questions about feelings, friendship problems and what to say when it goes wrong.', '# Ms Aria — AI tutor

## System prompt

You are Ms Aria, the teacher who asks instead of telling.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Ms Aria.
- Never discuss anything frightening, adult or unsafe. Redirect gently to feelings, friendship problems and what to say when it goes wrong.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Ms Aria, a friendly character who teaches children about feelings, friendship problems and what to say when it goes wrong.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Ms Aria","subject":"feelings, friendship problems and what to say when it goes wrong"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'kind-kids-club'), 'blog', 'What to Say When Your Child Has Been Unkind', 'A finished article for the site, written to be found in search.', '# What to Say When Your Child Has Been Unkind

Social-emotional learning is on every school curriculum and every parenting bestseller list, and there is far more demand than there is good material.

## Separate the act from the child out loud

Separate the act from the child out loud — "that was unkind" lands very differently from "you are unkind".

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

Ask what the other child''s face looked like. Recall builds empathy faster than a lecture.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

Repair beats punishment. Let them decide how to fix it and they will remember the fix.

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. The Truth Juno Should Not Have Said works well because juno says something true and unkind, and spends the day learning the difference … and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*Kind Kids Club is a complete collection of stories, videos, rhymes and printables for
children aged 4-8, and the adults navigating it with them.*', null, null, '{"words":620,"keywords":["social emotional learning books","kindness books for kids","feelings book children"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'kind-kids-club'), 'listing', 'Kind Kids Club — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — Kind Kids Club

## Amazon KDP

**Title.** The Truth Juno Should Not Have Said
**Subtitle.** Feelings, friendship and getting it wrong — a Kind Kids Club story for children aged 4-8, and the adults navigating it with them

**Description.**
Juno says something true and unkind, and spends the day learning the difference between honest and cruel.

Meet Juno, Sam, Ms Aria — the cast of Kind Kids Club, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 4-8, and the adults navigating it with them
- Part of the Kind Kids Club series

**Seven keywords.** social emotional learning books, kindness books for kids, feelings book children, friendship story kids, emotions colouring book, kind kids club

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $11.49 paperback / $4.49 Kindle

---

## Etsy

**Title.** Kind Kids Club Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from Kind Kids Club. Feelings, friendship and getting it wrong.

WHAT YOU GET
• A feelings wheel with twelve faces to colour
• Juno and Sam sitting back to back
• A "what I could say instead" comic strip to fill in
• A calm-down corner poster

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** social emotional learning books, kindness books for kids, feelings book children, friendship story kids, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $16

---

## Gumroad

**Product name.** Kind Kids Club — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
Kind Kids Club range, with commercial rights.

**Description.**
Social-emotional learning is on every school curriculum and every parenting bestseller list, and there is far more demand than there is good material.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $29

---

## YouTube

**Title.** The Truth Juno Should Not Have Said | Kind Kids Club Episode 1
**Short title.** Big Feeling, Small Body 🎵 | Kind Kids Club

**Description.**
Juno says something true and unkind, and spends the day learning the difference between honest and cruel.

Subscribe for a new kind kids club story every week.

00:00 The Truth Juno
00:05 The story begins
01:15 How it ends

**Tags.** social emotional learning books, kindness books for kids, feelings book children, friendship story kids, emotions colouring book, kids story, story time, read aloud
**Thumbnail.** Juno centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90),
  ((select id from public.dfy_niches where slug = 'little-chefs-kitchen'), 'website', 'Little Chefs Kitchen — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Little Chefs Kitchen — Food, measuring and eating the evidence</title>
<meta name="description" content="Food, measuring and eating the evidence. Children aged 5-10 who want to help in the kitchen.">
<style>
  :root { --from: #22c55e; --to: #eab308; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">🥕</div>
    <h1>Little Chefs Kitchen</h1>
    <p>Food, measuring and eating the evidence — written for children aged 5-10 who want to help in the kitchen.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Cooking with children is a niche where parents buy books, printables and courses — and the same customer comes back for the next age band.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>Basil tastes a soup that is almost right and works through every ingredient in the kitchen to find the missing one.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Basil, Nonna Pia and Whisk appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Wash, Chop, Stir, Taste" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>Whisk answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$27</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy Little Chefs Kitchen</a>
  </div>
</section>

<footer><div class="wrap">© Little Chefs Kitchen. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'little-chefs-kitchen'), 'storybook', 'The Soup That Needed One More Thing', 'Basil tastes a soup that is almost right and works through every ingredient in the kitchen to find the missing one.', '# The Soup That Needed One More Thing

**Logline.** Basil tastes a soup that is almost right and works through every ingredient in the kitchen to find the missing one.

**Cast.** Basil — a boy who tastes everything before it is ready; Nonna Pia — cooks entirely without measurements; Whisk — the kitchen cat, opinionated about fish

## Twelve-page beat sheet

1. We meet Basil doing the thing Basil always does.
2. Something is not where it should be.
3. Basil decides to find out why, against advice.
4. Nonna Pia comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Whisk, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Nonna Pia says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Basil fixes it in a way only Basil would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Basil: nine-year-old, apron three sizes too big, flour on his nose
Nonna Pia: small elderly woman, wooden spoon, no patience for scales
Whisk: fat ginger cat, always on the counter, never caught

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Soup That Needed One More Thing" for children aged 5-10 who want to help in the kitchen.

Logline: Basil tastes a soup that is almost right and works through every ingredient in the kitchen to find the missing one.

Cast, drawn identically on every page:
Basil: nine-year-old, apron three sizes too big, flour on his nose
Nonna Pia: small elderly woman, wooden spoon, no patience for scales
Whisk: fat ginger cat, always on the counter, never caught

Follow this beat sheet, one page per beat:
1. We meet Basil doing the thing Basil always does.
2. Something is not where it should be.
3. Basil decides to find out why, against advice.
4. Nonna Pia comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Whisk, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Nonna Pia says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Basil fixes it in a way only Basil would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 5-10 who want to help in the kitchen","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'little-chefs-kitchen'), 'storybook', 'Nonna Pia Loses the Recipe', 'A recipe nobody wrote down has to be rebuilt from memory, smell and three arguments.', '# Nonna Pia Loses the Recipe

**Logline.** A recipe nobody wrote down has to be rebuilt from memory, smell and three arguments.

**Cast.** Basil — a boy who tastes everything before it is ready; Nonna Pia — cooks entirely without measurements; Whisk — the kitchen cat, opinionated about fish

## Twelve-page beat sheet

1. We meet Basil doing the thing Basil always does.
2. Something is not where it should be.
3. Basil decides to find out why, against advice.
4. Nonna Pia comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Whisk, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Nonna Pia says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Basil fixes it in a way only Basil would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Basil: nine-year-old, apron three sizes too big, flour on his nose
Nonna Pia: small elderly woman, wooden spoon, no patience for scales
Whisk: fat ginger cat, always on the counter, never caught

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "Nonna Pia Loses the Recipe" for children aged 5-10 who want to help in the kitchen.

Logline: A recipe nobody wrote down has to be rebuilt from memory, smell and three arguments.

Cast, drawn identically on every page:
Basil: nine-year-old, apron three sizes too big, flour on his nose
Nonna Pia: small elderly woman, wooden spoon, no patience for scales
Whisk: fat ginger cat, always on the counter, never caught

Follow this beat sheet, one page per beat:
1. We meet Basil doing the thing Basil always does.
2. Something is not where it should be.
3. Basil decides to find out why, against advice.
4. Nonna Pia comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Whisk, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Nonna Pia says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Basil fixes it in a way only Basil would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 5-10 who want to help in the kitchen","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'little-chefs-kitchen'), 'video', 'Little Chefs Kitchen — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# Little Chefs Kitchen — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "Basil tastes a soup that is almost right and works through every ingredient in the kitchen to find the missing one…"
On screen: Basil, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Basil and the world in two sentences. No backstory.
Visual: wide establishing shot, Basil small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Nonna Pia reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: Whisk asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New little chefs kitchen story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. nine-year-old, apron three sizes too big, flour on his nose, wide establishing shot, golden hour, soft 3D Pixar style
2. Basil noticing the problem, close-up, worried expression, same style
3. small elderly woman, wooden spoon, no patience for scales, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "Little Chefs Kitchen".

Audience: Children aged 5-10 who want to help in the kitchen
Premise: Basil tastes a soup that is almost right and works through every ingredient in the kitchen to find the missing one.

Characters, identical in every scene:
Basil: nine-year-old, apron three sizes too big, flour on his nose
Nonna Pia: small elderly woman, wooden spoon, no patience for scales
Whisk: fat ginger cat, always on the counter, never caught

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'little-chefs-kitchen'), 'rhyme', 'Wash, Chop, Stir, Taste', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Wash, Chop, Stir, Taste

Wash your hands and roll your sleeve,
Tie the apron, do not leave.
Chop is careful, chop is slow,
Fingers curled and knuckles show.

Stir it round and stir it twice,
Add a pinch, then taste — that''s nice.
Salt makes sweet and sweet makes bright,
Cook it slow and taste it right.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
Wash your hands and roll your sleeve,
Tie the apron, do not leave.
Chop is careful, chop is slow,
Fingers curled and knuckles show.

Stir it round and stir it twice,
Add a pinch, then taste — that''s nice.
Salt makes sweet and sweet makes bright,
Cook it slow and taste it right.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Basil: nine-year-old, apron three sizes too big, flour on his nose
Nonna Pia: small elderly woman, wooden spoon, no patience for scales
Whisk: fat ginger cat, always on the counter, never caught
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'little-chefs-kitchen'), 'printable', 'Little Chefs Kitchen printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# Little Chefs Kitchen printable pack

1. Basil in his enormous apron
2. A measuring-cup matching worksheet
3. Ten vegetables to colour and name
4. A first-recipe card template

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
Basil in his enormous apron

Characters if shown: Basil: nine-year-old, apron three sizes too big, flour on his nose
Nonna Pia: small elderly woman, wooden spoon, no patience for scales
Whisk: fat ginger cat, always on the counter, never caught', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'little-chefs-kitchen'), 'tutor', 'Nonna Pia — AI tutor', 'An in-character tutor who answers questions about cooking, measuring, kitchen safety and where food comes from.', '# Nonna Pia — AI tutor

## System prompt

You are Nonna Pia, cooks entirely without measurements.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Nonna Pia.
- Never discuss anything frightening, adult or unsafe. Redirect gently to cooking, measuring, kitchen safety and where food comes from.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Nonna Pia, a friendly character who teaches children about cooking, measuring, kitchen safety and where food comes from.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Nonna Pia","subject":"cooking, measuring, kitchen safety and where food comes from"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'little-chefs-kitchen'), 'blog', 'The Five Kitchen Jobs a Five-Year-Old Can Actually Do', 'A finished article for the site, written to be found in search.', '# The Five Kitchen Jobs a Five-Year-Old Can Actually Do

Cooking with children is a niche where parents buy books, printables and courses — and the same customer comes back for the next age band.

## Tearing, stirring, sprinkling, pouring and pressing

Tearing, stirring, sprinkling, pouring and pressing — all five are safe and all five are genuinely useful.

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

Children who help cook eat more of what they helped make. This is one of the most repeated findings in child nutrition.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

Let them taste at every stage. Cooking is the only school subject where tasting is the method.

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. The Soup That Needed One More Thing works well because basil tastes a soup that is almost right and works through every ingredient in t… and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*Little Chefs Kitchen is a complete collection of stories, videos, rhymes and printables for
children aged 5-10 who want to help in the kitchen.*', null, null, '{"words":620,"keywords":["cooking with kids book","kids recipes children","first cookbook for children"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'little-chefs-kitchen'), 'listing', 'Little Chefs Kitchen — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — Little Chefs Kitchen

## Amazon KDP

**Title.** The Soup That Needed One More Thing
**Subtitle.** Food, measuring and eating the evidence — a Little Chefs Kitchen story for children aged 5-10 who want to help in the kitchen

**Description.**
Basil tastes a soup that is almost right and works through every ingredient in the kitchen to find the missing one.

Meet Basil, Nonna Pia, Whisk — the cast of Little Chefs Kitchen, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 5-10 who want to help in the kitchen
- Part of the Little Chefs Kitchen series

**Seven keywords.** cooking with kids book, kids recipes children, first cookbook for children, kitchen skills kids, food colouring pages, little chefs kitchen

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $12.99 paperback / $4.99 Kindle

---

## Etsy

**Title.** Little Chefs Kitchen Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from Little Chefs Kitchen. Food, measuring and eating the evidence.

WHAT YOU GET
• Basil in his enormous apron
• A measuring-cup matching worksheet
• Ten vegetables to colour and name
• A first-recipe card template

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** cooking with kids book, kids recipes children, first cookbook for children, kitchen skills kids, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $15

---

## Gumroad

**Product name.** Little Chefs Kitchen — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
Little Chefs Kitchen range, with commercial rights.

**Description.**
Cooking with children is a niche where parents buy books, printables and courses — and the same customer comes back for the next age band.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $27

---

## YouTube

**Title.** The Soup That Needed One More Thing | Little Chefs Kitchen Episode 1
**Short title.** Wash, Chop, Stir, Taste 🎵 | Little Chefs Kitchen

**Description.**
Basil tastes a soup that is almost right and works through every ingredient in the kitchen to find the missing one.

Subscribe for a new little chefs kitchen story every week.

00:00 The Soup That
00:05 The story begins
01:15 How it ends

**Tags.** cooking with kids book, kids recipes children, first cookbook for children, kitchen skills kids, food colouring pages, kids story, story time, read aloud
**Thumbnail.** Basil centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90),
  ((select id from public.dfy_niches where slug = 'dream-machines'), 'website', 'Dream Machines — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dream Machines — Diggers, trains and everything with wheels</title>
<meta name="description" content="Diggers, trains and everything with wheels. Children aged 3-7, especially reluctant readers.">
<style>
  :root { --from: #f59e0b; --to: #ef4444; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">🚜</div>
    <h1>Dream Machines</h1>
    <p>Diggers, trains and everything with wheels — written for children aged 3-7, especially reluctant readers.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Vehicle books are the single most reliable way to get a reluctant three-to-five-year-old reader to sit still, and parents know it.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>Dot is left behind on the biggest build in town until the one job nobody else can reach turns out to be hers.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Digger Dot, Rusty and Beep appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Dig It, Lift It, Roll It Home" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>Beep answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$19</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy Dream Machines</a>
  </div>
</section>

<footer><div class="wrap">© Dream Machines. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'dream-machines'), 'storybook', 'Too Small for the Big Job', 'Dot is left behind on the biggest build in town until the one job nobody else can reach turns out to be hers.', '# Too Small for the Big Job

**Logline.** Dot is left behind on the biggest build in town until the one job nobody else can reach turns out to be hers.

**Cast.** Digger Dot — a small excavator who wants the big jobs; Rusty — an old crane who has built half the town; Beep — a delivery van who is always somewhere else

## Twelve-page beat sheet

1. We meet Digger Dot doing the thing Digger Dot always does.
2. Something is not where it should be.
3. Digger Dot decides to find out why, against advice.
4. Rusty comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Beep, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Rusty says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Digger Dot fixes it in a way only Digger Dot would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Digger Dot: yellow mini excavator, dented bucket, headlight eyes
Rusty: tall red crane, peeling paint, slow and certain
Beep: little blue van, one wonky wing mirror

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "Too Small for the Big Job" for children aged 3-7, especially reluctant readers.

Logline: Dot is left behind on the biggest build in town until the one job nobody else can reach turns out to be hers.

Cast, drawn identically on every page:
Digger Dot: yellow mini excavator, dented bucket, headlight eyes
Rusty: tall red crane, peeling paint, slow and certain
Beep: little blue van, one wonky wing mirror

Follow this beat sheet, one page per beat:
1. We meet Digger Dot doing the thing Digger Dot always does.
2. Something is not where it should be.
3. Digger Dot decides to find out why, against advice.
4. Rusty comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Beep, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Rusty says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Digger Dot fixes it in a way only Digger Dot would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 3-7, especially reluctant readers","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'dream-machines'), 'storybook', 'The Night the Bridge Went Up', 'The whole yard works through the night, each machine doing the one thing it is shaped for.', '# The Night the Bridge Went Up

**Logline.** The whole yard works through the night, each machine doing the one thing it is shaped for.

**Cast.** Digger Dot — a small excavator who wants the big jobs; Rusty — an old crane who has built half the town; Beep — a delivery van who is always somewhere else

## Twelve-page beat sheet

1. We meet Digger Dot doing the thing Digger Dot always does.
2. Something is not where it should be.
3. Digger Dot decides to find out why, against advice.
4. Rusty comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Beep, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Rusty says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Digger Dot fixes it in a way only Digger Dot would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Digger Dot: yellow mini excavator, dented bucket, headlight eyes
Rusty: tall red crane, peeling paint, slow and certain
Beep: little blue van, one wonky wing mirror

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Night the Bridge Went Up" for children aged 3-7, especially reluctant readers.

Logline: The whole yard works through the night, each machine doing the one thing it is shaped for.

Cast, drawn identically on every page:
Digger Dot: yellow mini excavator, dented bucket, headlight eyes
Rusty: tall red crane, peeling paint, slow and certain
Beep: little blue van, one wonky wing mirror

Follow this beat sheet, one page per beat:
1. We meet Digger Dot doing the thing Digger Dot always does.
2. Something is not where it should be.
3. Digger Dot decides to find out why, against advice.
4. Rusty comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Beep, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Rusty says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Digger Dot fixes it in a way only Digger Dot would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 3-7, especially reluctant readers","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'dream-machines'), 'video', 'Dream Machines — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# Dream Machines — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "Dot is left behind on the biggest build in town until the one job nobody else can reach turns out to be hers…"
On screen: Digger Dot, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Digger Dot and the world in two sentences. No backstory.
Visual: wide establishing shot, Digger Dot small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Rusty reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: Beep asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New dream machines story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. yellow mini excavator, dented bucket, headlight eyes, wide establishing shot, golden hour, soft 3D Pixar style
2. Digger Dot noticing the problem, close-up, worried expression, same style
3. tall red crane, peeling paint, slow and certain, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "Dream Machines".

Audience: Children aged 3-7, especially reluctant readers
Premise: Dot is left behind on the biggest build in town until the one job nobody else can reach turns out to be hers.

Characters, identical in every scene:
Digger Dot: yellow mini excavator, dented bucket, headlight eyes
Rusty: tall red crane, peeling paint, slow and certain
Beep: little blue van, one wonky wing mirror

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'dream-machines'), 'rhyme', 'Dig It, Lift It, Roll It Home', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Dig It, Lift It, Roll It Home

Dig it down and scoop it out,
Shake the bucket, hear it shout.
Lift it high and swing it round,
Set it gently on the ground.

Roll it, roll it, roll it flat,
Beep the horn and tip your hat.
Engines off and lights go dim —
Every machine is tucked in.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
Dig it down and scoop it out,
Shake the bucket, hear it shout.
Lift it high and swing it round,
Set it gently on the ground.

Roll it, roll it, roll it flat,
Beep the horn and tip your hat.
Engines off and lights go dim —
Every machine is tucked in.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Digger Dot: yellow mini excavator, dented bucket, headlight eyes
Rusty: tall red crane, peeling paint, slow and certain
Beep: little blue van, one wonky wing mirror
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'dream-machines'), 'printable', 'Dream Machines printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# Dream Machines printable pack

1. Digger Dot with her bucket raised
2. Six vehicles to match to their jobs
3. A construction site scene to colour
4. A wheels-counting worksheet

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
Digger Dot with her bucket raised

Characters if shown: Digger Dot: yellow mini excavator, dented bucket, headlight eyes
Rusty: tall red crane, peeling paint, slow and certain
Beep: little blue van, one wonky wing mirror', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'dream-machines'), 'tutor', 'Rusty — AI tutor', 'An in-character tutor who answers questions about machines, how things are built and what every vehicle is for.', '# Rusty — AI tutor

## System prompt

You are Rusty, an old crane who has built half the town.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Rusty.
- Never discuss anything frightening, adult or unsafe. Redirect gently to machines, how things are built and what every vehicle is for.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Rusty, a friendly character who teaches children about machines, how things are built and what every vehicle is for.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Rusty","subject":"machines, how things are built and what every vehicle is for"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'dream-machines'), 'blog', 'Why Vehicle Books Work on Children Who Will Not Sit Still', 'A finished article for the site, written to be found in search.', '# Why Vehicle Books Work on Children Who Will Not Sit Still

Vehicle books are the single most reliable way to get a reluctant three-to-five-year-old reader to sit still, and parents know it.

## A digger book has a job on every page

A digger book has a job on every page — the child is watching a task complete, not following a plot.

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

Sound words give a non-reader something to do out loud, which is often the whole barrier.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

Machines have obvious purposes, and a three-year-old is busy working out what everything is for.

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. Too Small for the Big Job works well because dot is left behind on the biggest build in town until the one job nobody else ca… and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*Dream Machines is a complete collection of stories, videos, rhymes and printables for
children aged 3-7, especially reluctant readers.*', null, null, '{"words":620,"keywords":["truck books for toddlers","construction vehicles kids","digger book children"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'dream-machines'), 'listing', 'Dream Machines — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — Dream Machines

## Amazon KDP

**Title.** Too Small for the Big Job
**Subtitle.** Diggers, trains and everything with wheels — a Dream Machines story for children aged 3-7, especially reluctant readers

**Description.**
Dot is left behind on the biggest build in town until the one job nobody else can reach turns out to be hers.

Meet Digger Dot, Rusty, Beep — the cast of Dream Machines, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 3-7, especially reluctant readers
- Part of the Dream Machines series

**Seven keywords.** truck books for toddlers, construction vehicles kids, digger book children, train story toddler, vehicle colouring book, dream machines

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $8.99 paperback / $2.99 Kindle

---

## Etsy

**Title.** Dream Machines Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from Dream Machines. Diggers, trains and everything with wheels.

WHAT YOU GET
• Digger Dot with her bucket raised
• Six vehicles to match to their jobs
• A construction site scene to colour
• A wheels-counting worksheet

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** truck books for toddlers, construction vehicles kids, digger book children, train story toddler, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $11

---

## Gumroad

**Product name.** Dream Machines — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
Dream Machines range, with commercial rights.

**Description.**
Vehicle books are the single most reliable way to get a reluctant three-to-five-year-old reader to sit still, and parents know it.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $19

---

## YouTube

**Title.** Too Small for the Big Job | Dream Machines Episode 1
**Short title.** Dig It, Lift It, Roll It Home 🎵 | Dream Machines

**Description.**
Dot is left behind on the biggest build in town until the one job nobody else can reach turns out to be hers.

Subscribe for a new dream machines story every week.

00:00 Too Small for
00:05 The story begins
01:15 How it ends

**Tags.** truck books for toddlers, construction vehicles kids, digger book children, train story toddler, vehicle colouring book, kids story, story time, read aloud
**Thumbnail.** Digger Dot centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90),
  ((select id from public.dfy_niches where slug = 'world-explorers'), 'website', 'World Explorers — one-page website', 'A complete, self-contained landing page. Open it, change the buy link, upload it.', '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>World Explorers — One country, one story, one thing you did not know</title>
<meta name="description" content="One country, one story, one thing you did not know. Children aged 6-10, and homeschooling families.">
<style>
  :root { --from: #14b8a6; --to: #3b82f6; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-rounded, "Segoe UI", system-ui, sans-serif; color:#1e293b; line-height:1.6; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; padding: 80px 0 96px; text-align:center; }
  header .emoji { font-size: 64px; }
  h1 { font-size: clamp(32px, 6vw, 56px); margin: 12px 0; letter-spacing:-.02em; }
  header p { font-size: 20px; opacity:.92; max-width: 620px; margin: 0 auto 32px; }
  .cta { display:inline-block; background:#fff; color:#111; padding:16px 36px; border-radius:999px;
         font-weight:700; text-decoration:none; box-shadow:0 12px 30px rgba(0,0,0,.18); }
  section { padding: 72px 0; }
  h2 { font-size: 32px; margin: 0 0 8px; }
  .lede { color:#64748b; margin: 0 0 40px; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); }
  .card { border:1px solid #e2e8f0; border-radius:20px; padding:28px; }
  .card h3 { margin:0 0 8px; font-size:18px; }
  .card p { margin:0; color:#64748b; font-size:15px; }
  .alt { background:#f8fafc; }
  .price { text-align:center; }
  .price .amount { font-size:52px; font-weight:800; }
  .price .cta { background: linear-gradient(135deg, var(--from), var(--to)); color:#fff; }
  footer { padding:40px 0; text-align:center; color:#94a3b8; font-size:14px; }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="emoji">🌍</div>
    <h1>World Explorers</h1>
    <p>One country, one story, one thing you did not know — written for children aged 6-10, and homeschooling families.</p>
    <a class="cta" href="#buy">Get the collection</a>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>Why parents keep coming back</h2>
    <p class="lede">Geography and culture packs sell to homeschoolers and to schools, and the format extends to as many countries as you are willing to write.</p>
    <div class="grid">
      <div class="card"><h3>Stories with a point</h3><p>In a town where nothing has a price tag, Ada and Tobi learn to barter — and what a thing is really worth.</p></div>
      <div class="card"><h3>Characters they remember</h3><p>Ada, Tobi and Compass appear across every book, so each new title feels like meeting friends.</p></div>
      <div class="card"><h3>Made to be read aloud</h3><p>Short sentences, a steady rhythm and a proper ending. Nothing that trails off at bedtime.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What is inside</h2>
    <p class="lede">Everything below is included, ready to publish or print.</p>
    <div class="grid">
      <div class="card"><h3>📖 Storybooks</h3><p>Two complete illustrated stories with a full panel breakdown.</p></div>
      <div class="card"><h3>🎬 Video script</h3><p>A narrated episode, scene by scene, ready to produce.</p></div>
      <div class="card"><h3>🎵 Original rhyme</h3><p>"Hello in Ten Ways" — lyrics and a suggested melody.</p></div>
      <div class="card"><h3>🖨️ Printables</h3><p>Colouring pages and worksheets that match the stories.</p></div>
      <div class="card"><h3>🤖 AI tutor</h3><p>Compass answers your reader''s questions in character.</p></div>
      <div class="card"><h3>✍️ Blog content</h3><p>A finished article to bring parents in from search.</p></div>
    </div>
  </div>
</section>

<section class="price" id="buy">
  <div class="wrap">
    <h2>Take the whole collection</h2>
    <p class="lede">Commercial rights included. Sell it, print it, publish it under your own name.</p>
    <div class="amount">$29</div>
    <p class="lede">One payment. Yours to keep.</p>
    <a class="cta" href="#">Buy World Explorers</a>
  </div>
</section>

<footer><div class="wrap">© World Explorers. All rights reserved.</div></footer>

</body>
</html>', null, null, '{"format":"HTML","responsive":true,"sections":6}'::jsonb, array['gumroad', 'etsy'], 10),
  ((select id from public.dfy_niches where slug = 'world-explorers'), 'storybook', 'The Market With No Prices', 'In a town where nothing has a price tag, Ada and Tobi learn to barter — and what a thing is really worth.', '# The Market With No Prices

**Logline.** In a town where nothing has a price tag, Ada and Tobi learn to barter — and what a thing is really worth.

**Cast.** Ada — travels with a notebook and no plan; Tobi — her cousin, who reads the guidebook cover to cover; Compass — their grandmother''s battered brass compass, which points at whatever is interesting

## Twelve-page beat sheet

1. We meet Ada doing the thing Ada always does.
2. Something is not where it should be.
3. Ada decides to find out why, against advice.
4. Tobi comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Compass, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Tobi says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Ada fixes it in a way only Ada would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Ada: ten-year-old, short dark hair, camera round her neck
Tobi: boy of eleven, glasses, enormous backpack
Compass: old brass compass, cracked glass, needle that will not settle

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Market With No Prices" for children aged 6-10, and homeschooling families.

Logline: In a town where nothing has a price tag, Ada and Tobi learn to barter — and what a thing is really worth.

Cast, drawn identically on every page:
Ada: ten-year-old, short dark hair, camera round her neck
Tobi: boy of eleven, glasses, enormous backpack
Compass: old brass compass, cracked glass, needle that will not settle

Follow this beat sheet, one page per beat:
1. We meet Ada doing the thing Ada always does.
2. Something is not where it should be.
3. Ada decides to find out why, against advice.
4. Tobi comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Compass, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Tobi says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Ada fixes it in a way only Ada would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 6-10, and homeschooling families","book":1}'::jsonb, array['kdp', 'gumroad'], 20),
  ((select id from public.dfy_niches where slug = 'world-explorers'), 'storybook', 'The Longest Word in the Village', 'A word that cannot be translated sends the cousins around a whole community to understand one idea.', '# The Longest Word in the Village

**Logline.** A word that cannot be translated sends the cousins around a whole community to understand one idea.

**Cast.** Ada — travels with a notebook and no plan; Tobi — her cousin, who reads the guidebook cover to cover; Compass — their grandmother''s battered brass compass, which points at whatever is interesting

## Twelve-page beat sheet

1. We meet Ada doing the thing Ada always does.
2. Something is not where it should be.
3. Ada decides to find out why, against advice.
4. Tobi comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Compass, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Tobi says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Ada fixes it in a way only Ada would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

## Character sheet — keep these exact for consistency

Ada: ten-year-old, short dark hair, camera round her neck
Tobi: boy of eleven, glasses, enormous backpack
Compass: old brass compass, cracked glass, needle that will not settle

## How to finish it

Paste the prompt below into Story to Comic. It will write the dialogue and
break every beat into panels. Then run each panel prompt through the Comic
Generator with the character sheet above pasted in, so the cast looks the same
on every page.', 'Write a 12-page children''s comic titled "The Longest Word in the Village" for children aged 6-10, and homeschooling families.

Logline: A word that cannot be translated sends the cousins around a whole community to understand one idea.

Cast, drawn identically on every page:
Ada: ten-year-old, short dark hair, camera round her neck
Tobi: boy of eleven, glasses, enormous backpack
Compass: old brass compass, cracked glass, needle that will not settle

Follow this beat sheet, one page per beat:
1. We meet Ada doing the thing Ada always does.
2. Something is not where it should be.
3. Ada decides to find out why, against advice.
4. Tobi comes along, for the wrong reason.
5. The first attempt makes it worse.
6. They meet Compass, who asks a question instead of helping.
7. A quiet page. Nothing happens, and that is the point.
8. Tobi says the thing nobody wanted to say.
9. The real problem turns out to be smaller and closer than expected.
10. Ada fixes it in a way only Ada would think of.
11. Everyone comes back together.
12. The last page mirrors the first, changed.

Tone: warm, gentle, funny in small ways. Short sentences a child can read aloud.
Two panels per page. End on a page that mirrors page one, changed.
Art style: soft 3D Pixar-style children''s illustration, bright, rounded shapes.', 'comic-agent', '{"pages":12,"panels_per_page":2,"reading_age":"Children aged 6-10, and homeschooling families","book":2}'::jsonb, array['kdp', 'gumroad'], 30),
  ((select id from public.dfy_niches where slug = 'world-explorers'), 'video', 'World Explorers — episode one video script', 'A 90-second narrated episode: hook, three scenes, and a call to action.', '# World Explorers — Episode 1

**Target length:** 90 seconds. **Formats:** 16:9 for YouTube, 9:16 for Shorts and Reels.

---

**0:00 — Hook (5s)**
Narration: "In a town where nothing has a price tag, Ada and Tobi learn to barter — and what a thing is really worth…"
On screen: Ada, mid-action, looking straight at us.

**0:05 — Scene 1 (20s)**
Narration: introduce Ada and the world in two sentences. No backstory.
Visual: wide establishing shot, Ada small in the frame.

**0:25 — Scene 2 (25s)**
Narration: the problem arrives. Tobi reacts badly.
Visual: close on both faces, cut between them.

**0:50 — Scene 3 (25s)**
Narration: Compass asks the question that turns it around.
Visual: the three together, warm light.

**1:15 — Resolution (10s)**
Narration: one line. Do not explain the moral.
Visual: return to the opening shot, changed.

**1:25 — Call to action (5s)**
Narration: "New world explorers story every week. Subscribe so you do not miss it."

---

## Scene prompts

1. ten-year-old, short dark hair, camera round her neck, wide establishing shot, golden hour, soft 3D Pixar style
2. Ada noticing the problem, close-up, worried expression, same style
3. boy of eleven, glasses, enormous backpack, reacting, mid shot, same style
4. All three characters together, warm interior light, same style
5. The opening location again, calmer, same style', 'Create a 90-second children''s video episode for "World Explorers".

Audience: Children aged 6-10, and homeschooling families
Premise: In a town where nothing has a price tag, Ada and Tobi learn to barter — and what a thing is really worth.

Characters, identical in every scene:
Ada: ten-year-old, short dark hair, camera round her neck
Tobi: boy of eleven, glasses, enormous backpack
Compass: old brass compass, cracked glass, needle that will not settle

Structure: 5s hook, three 20-25s scenes, 10s resolution, 5s subscribe ask.
Narration must be readable by one voice at a calm pace. No dialogue tags.
Art style: soft 3D Pixar-style children''s animation, bright and rounded.', 'comic-video', '{"duration":"90s","scenes":5,"format":"16:9 and 9:16"}'::jsonb, array['youtube'], 40),
  ((select id from public.dfy_niches where slug = 'world-explorers'), 'rhyme', 'Hello in Ten Ways', 'An original rhyme, free of copyright, with a suggested melody and actions.', '# Hello in Ten Ways

Hola, bonjour, konnichiwa,
Jambo, namaste, salaam.
Ni hao, ciao and shalom too,
Ten ways of saying hello to you.

Ten different words, one open hand,
Ten different flags in ten different sand.
Say it slowly, say it wrong —
They will smile and help you along.

---

**Melody.** Fits the metre of *Twinkle Twinkle Little Star*, so a parent can sing
it without learning anything new. Written to be original — no existing lyrics are
reused, so it is safe to publish and monetise.

**Actions.** Give each verse one repeated hand movement. Under-fives join in with
the movement several readings before they join in with the words.

**Use it for.** The closing page of a book, a 30-second Short, or a printable
poster for a nursery wall.', 'Create a gentle animated nursery-rhyme video for young children.

Lyrics:
Hola, bonjour, konnichiwa,
Jambo, namaste, salaam.
Ni hao, ciao and shalom too,
Ten ways of saying hello to you.

Ten different words, one open hand,
Ten different flags in ten different sand.
Say it slowly, say it wrong —
They will smile and help you along.

One illustrated scene per couplet, soft 3D Pixar style, bright and rounded.
Characters: Ada: ten-year-old, short dark hair, camera round her neck
Tobi: boy of eleven, glasses, enormous backpack
Compass: old brass compass, cracked glass, needle that will not settle
Pace it slowly enough for a three-year-old to sing along.', 'video', '{"verses":2,"melody":"Twinkle Twinkle metre","singable":true}'::jsonb, array['youtube', 'gumroad'], 50),
  ((select id from public.dfy_niches where slug = 'world-explorers'), 'printable', 'World Explorers printable pack', 'Colouring pages and worksheets, sized for A4 and US Letter.', '# World Explorers printable pack

1. A blank world map to colour by continent
2. Ada and Tobi with their compass
3. Ten flags to colour and name
4. A "hello in ten languages" tracing sheet

---

**Producing them.** Run each line above through the Colouring Book tool. Ask for
thick black outlines, no shading and plenty of white space — thin lines look
good on screen and disappear when a four-year-old uses a crayon on them.

**Selling them.** Export at 300 DPI, A4 and US Letter. Etsy buyers expect both,
and a listing that says "instant download, both sizes" converts better than one
that does not.', 'Black and white colouring page for children, thick clean outlines, no shading,
large simple shapes, plenty of white space, printable line art:
A blank world map to colour by continent

Characters if shown: Ada: ten-year-old, short dark hair, camera round her neck
Tobi: boy of eleven, glasses, enormous backpack
Compass: old brass compass, cracked glass, needle that will not settle', 'coloring', '{"sheets":4,"size":"A4 + US Letter","dpi":300}'::jsonb, array['etsy', 'gumroad', 'kdp'], 60),
  ((select id from public.dfy_niches where slug = 'world-explorers'), 'tutor', 'Ada — AI tutor', 'An in-character tutor who answers questions about countries, cultures, languages and how people live elsewhere.', '# Ada — AI tutor

## System prompt

You are Ada, travels with a notebook and no plan.
You are talking to a child aged 4-8.

Rules you never break:
- Answer in two or three short sentences. Stop there.
- Use words a child of that age already knows. If you must use a new word, say what it means in the same breath.
- Compare everything to something in an ordinary house or garden.
- End with a question back, so the child keeps talking.
- If you do not know, say so plainly. "Nobody has worked that out yet" is a good answer.
- Never mention that you are an AI. You are Ada.
- Never discuss anything frightening, adult or unsafe. Redirect gently to countries, cultures, languages and how people live elsewhere.

## Opening line

"Oh — hello. I was just about to look at something interesting. Do you want to see?"

## Try it with

- "Why is the sky like that?"
- "What is your favourite one?"
- "Can you tell me a secret about it?"
- "I do not understand."
- "Tell me something nobody knows."', 'You are Ada, a friendly character who teaches children about countries, cultures, languages and how people live elsewhere.
Answer in two or three short sentences using words a young child knows, compare things
to objects in an ordinary house, and always end with a question back to the child.', 'chat', '{"character":"Ada","subject":"countries, cultures, languages and how people live elsewhere"}'::jsonb, array['gumroad'], 70),
  ((select id from public.dfy_niches where slug = 'world-explorers'), 'blog', 'Teaching Geography Without a Single Capital City', 'A finished article for the site, written to be found in search.', '# Teaching Geography Without a Single Capital City

Geography and culture packs sell to homeschoolers and to schools, and the format extends to as many countries as you are willing to write.

## Start with what a child there eats for breakfast

Start with what a child there eats for breakfast. Facts about a country stick to a person, not to a map.

It is worth saying plainly, because most advice on this goes the other way. Parents
are told to keep introducing new material, to keep things fresh, to keep moving. In
practice the opposite is what works for this age group, and you can watch it happen
over a week.

## What to do instead

Capitals and flags are recall; comparing two school days is thinking.

Try it for four nights and watch what changes. You are not looking for enthusiasm —
you are looking for the moment your child stops asking what happens next, because
they already know, and can finally relax into it.

## The part nobody mentions

Get one thing wrong on purpose and let them find it. Nothing fixes a fact faster.

This is the bit that surprises people. It feels like nothing is happening. It is the
most productive part of the whole exercise.

## Where to start

Pick one story. The Market With No Prices works well because in a town where nothing has a price tag, ada and tobi learn to barter — and what… and the ending returns to
where it began, which is exactly the shape a young child finds satisfying.

Read it tonight. Read it again tomorrow. Then read it a third time and notice who is
finishing the sentences.

---

*World Explorers is a complete collection of stories, videos, rhymes and printables for
children aged 6-10, and homeschooling families.*', null, null, '{"words":620,"keywords":["geography books for kids","countries of the world children","multicultural kids books"]}'::jsonb, '{}', 80),
  ((select id from public.dfy_niches where slug = 'world-explorers'), 'listing', 'World Explorers — marketplace listings', 'Titles, descriptions, keywords and categories for KDP, Etsy, Gumroad and YouTube.', '# Marketplace listings — World Explorers

## Amazon KDP

**Title.** The Market With No Prices
**Subtitle.** One country, one story, one thing you did not know — a World Explorers story for children aged 6-10, and homeschooling families

**Description.**
In a town where nothing has a price tag, Ada and Tobi learn to barter — and what a thing is really worth.

Meet Ada, Tobi, Compass — the cast of World Explorers, a series
written to be read aloud. Short sentences, a steady rhythm and a proper ending.

- Twelve full-colour pages
- Written for children aged 6-10, and homeschooling families
- Part of the World Explorers series

**Seven keywords.** geography books for kids, countries of the world children, multicultural kids books, homeschool geography, world cultures kids, world explorers

**Categories.** Children''s Books > Animals; Children''s Books > Growing Up & Facts of Life
**Price.** $11.99 paperback / $4.49 Kindle

---

## Etsy

**Title.** World Explorers Printable Pack | 4 Colouring Pages & Worksheets | Instant Download | A4 + US Letter

**Description.**
An instant-download pack from World Explorers. One country, one story, one thing you did not know.

WHAT YOU GET
• A blank world map to colour by continent
• Ada and Tobi with their compass
• Ten flags to colour and name
• A "hello in ten languages" tracing sheet

• A4 and US Letter, 300 DPI, print at home
• Instant download — no physical item is shipped

**Tags.** geography books for kids, countries of the world children, multicultural kids books, homeschool geography, printable, instant download, kids activity, homeschool, classroom, digital download
**Price.** $16

---

## Gumroad

**Product name.** World Explorers — the complete collection

**Summary.** Every story, video script, rhyme, printable and blog post in the
World Explorers range, with commercial rights.

**Description.**
Geography and culture packs sell to homeschoolers and to schools, and the format extends to as many countries as you are willing to write.

This is the whole business in one download: two illustrated storybooks, a video
script, an original rhyme, 4 printables, an AI tutor and a
finished blog article. Publish it, print it, sell it under your own name.

**Price.** $29

---

## YouTube

**Title.** The Market With No Prices | World Explorers Episode 1
**Short title.** Hello in Ten Ways 🎵 | World Explorers

**Description.**
In a town where nothing has a price tag, Ada and Tobi learn to barter — and what a thing is really worth.

Subscribe for a new world explorers story every week.

00:00 The Market With
00:05 The story begins
01:15 How it ends

**Tags.** geography books for kids, countries of the world children, multicultural kids books, homeschool geography, world cultures kids, kids story, story time, read aloud
**Thumbnail.** Ada centred, huge expression, three words maximum in the corner.', null, null, '{"platforms":4}'::jsonb, array['kdp', 'etsy', 'gumroad', 'youtube'], 90);


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select n.name, count(a.id) as assets
  from public.dfy_niches n
  left join public.dfy_assets a on a.niche_id = n.id
 group by n.name, n.sort_order
 order by n.sort_order;
