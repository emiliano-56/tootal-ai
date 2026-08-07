/**
 * Turning a stored agent result back into something a person can read.
 *
 * The history page used to print `JSON.stringify(output)` into a <pre>. That is
 * a debugging view: it shows a customer their story as `{"pages":[{"panels":`…
 * and gives them no way to tell whether the run was any good.
 *
 * Every agent stores a different shape, so this maps each one onto a small
 * common vocabulary — a heading, some prose, a list, a gallery — which the page
 * then renders. Anything unrecognised still falls back to the raw view rather
 * than showing nothing, because a new agent should not break history.
 *
 * Pure, so each shape can be tested against a real stored payload.
 */

export type Block =
  | { type: 'text'; label?: string; value: string }
  | { type: 'quote'; label?: string; value: string }
  | { type: 'list'; label?: string; items: string[] }
  | { type: 'pairs'; label?: string; items: { name: string; value: string }[] }
  | { type: 'gallery'; label?: string; images: { url: string; caption?: string }[] }
  | { type: 'pages'; label?: string; pages: { heading: string; lines: string[] }[] }
  | { type: 'html'; label?: string; value: string }
  | { type: 'raw'; label?: string; value: string }

export interface Presented {
  title: string
  subtitle?: string
  blocks: Block[]
}

const str = (value: unknown): string =>
  value === null || value === undefined || typeof value === 'object' ? '' : String(value)

const arr = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value.filter((v) => v && typeof v === 'object') as Record<string, unknown>[]) : []

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(str).filter(Boolean) : []

/** Drop empty blocks so a partial result does not render a wall of headings. */
function compact(blocks: (Block | null)[]): Block[] {
  return blocks.filter((block): block is Block => {
    if (!block) return false

    if (block.type === 'list') return block.items.length > 0
    if (block.type === 'pairs') return block.items.length > 0
    if (block.type === 'gallery') return block.images.length > 0
    if (block.type === 'pages') return block.pages.length > 0

    return Boolean((block as { value?: string }).value)
  })
}

// ---------------------------------------------------------------------------
//  One presenter per agent
// ---------------------------------------------------------------------------

function comic(output: Record<string, unknown>): Presented {
  const pages = arr(output.pages).map((page, index) => {
    const panels = arr(page.panels)

    return {
      heading: `Page ${str(page.page_number) || index + 1}${
        page.scene_title ? ` — ${str(page.scene_title)}` : ''
      }`,
      lines: [
        str(page.scene_summary),
        // Dialogue is what a reader actually reads; the image prompt is
        // production detail and belongs in the download, not on the page.
        ...panels.flatMap((panel) =>
          arr(panel.dialogues).map((line) =>
            line.speaker ? `${str(line.speaker)}: ${str(line.text)}` : str(line.text)
          )
        ),
        ...panels.map((panel) => str(panel.caption)),
      ].filter(Boolean),
    }
  })

  return {
    title: str(output.title) || 'Comic',
    subtitle: str(output.logline) || undefined,
    blocks: compact([
      output.story ? { type: 'text', label: 'Story', value: str(output.story) } : null,
      {
        type: 'pairs',
        label: 'Characters',
        items: arr(output.characters).map((character) => ({
          name: str(character.name),
          value: str(character.description) || str(character.appearance),
        })),
      },
      { type: 'pages', label: 'Pages', pages },
    ]),
  }
}

function video(output: Record<string, unknown>): Presented {
  const shots = arr(output.shots).length > 0 ? arr(output.shots) : arr(output.scenes)

  return {
    title: str(output.title) || 'Video',
    subtitle: str(output.logline) || str(output.hook) || undefined,
    blocks: compact([
      {
        type: 'pages',
        label: 'Scenes',
        pages: shots.map((shot, index) => ({
          heading: `Scene ${index + 1}${shot.duration ? ` · ${str(shot.duration)}` : ''}`,
          lines: [str(shot.narration), str(shot.caption), str(shot.visual)].filter(Boolean),
        })),
      },
      output.video_url
        ? { type: 'gallery', label: 'Result', images: [{ url: str(output.video_url) }] }
        : null,
    ]),
  }
}

function cover(output: Record<string, unknown>): Presented {
  const images = [
    ...strings(output.images).map((url) => ({ url })),
    ...arr(output.covers).map((entry) => ({ url: str(entry.url), caption: str(entry.style) })),
    ...(output.image_url ? [{ url: str(output.image_url) }] : []),
  ].filter((image) => image.url)

  return {
    title: str(output.title) || 'Book cover',
    subtitle: str(output.subtitle) || undefined,
    blocks: compact([
      { type: 'gallery', label: 'Covers', images },
      output.blurb ? { type: 'quote', value: str(output.blurb) } : null,
      { type: 'list', label: 'Taglines', items: strings(output.taglines) },
    ]),
  }
}

function landing(output: Record<string, unknown>): Presented {
  return {
    title: str(output.headline) || str(output.title) || 'Landing page',
    subtitle: str(output.subheadline) || undefined,
    blocks: compact([
      output.html ? { type: 'html', label: 'Page', value: str(output.html) } : null,
      {
        type: 'pairs',
        label: 'Sections',
        items: arr(output.sections).map((section) => ({
          name: str(section.heading) || str(section.title),
          value: str(section.body) || str(section.content),
        })),
      },
      { type: 'list', label: 'Benefits', items: strings(output.benefits) },
      output.cta ? { type: 'text', label: 'Call to action', value: str(output.cta) } : null,
    ]),
  }
}

function marketing(output: Record<string, unknown>): Presented {
  const named = (key: string, label: string): Block | null => {
    const items = strings(output[key])

    return items.length > 0 ? { type: 'list', label, items } : null
  }

  return {
    title: str(output.title) || 'Marketing kit',
    blocks: compact([
      named('headlines', 'Headlines'),
      named('emails', 'Emails'),
      named('captions', 'Social captions'),
      named('ads', 'Ads'),
      named('keywords', 'Keywords'),
      named('hashtags', 'Hashtags'),
      {
        type: 'pairs',
        label: 'Assets',
        items: arr(output.assets).map((asset) => ({
          name: str(asset.kind) || str(asset.name),
          value: str(asset.content) || str(asset.body),
        })),
      },
    ]),
  }
}

function business(output: Record<string, unknown>): Presented {
  return {
    title: str(output.business_name) || str(output.title) || 'Business plan',
    subtitle: str(output.tagline) || str(output.one_liner) || undefined,
    blocks: compact([
      output.summary ? { type: 'text', label: 'Summary', value: str(output.summary) } : null,
      { type: 'list', label: 'Products', items: strings(output.products) },
      { type: 'list', label: 'Audience', items: strings(output.audience) },
      {
        type: 'pairs',
        label: 'Plan',
        items: arr(output.steps).map((step, index) => ({
          name: str(step.title) || `Step ${index + 1}`,
          value: str(step.detail) || str(step.description),
        })),
      },
      { type: 'list', label: 'Pricing', items: strings(output.pricing) },
    ]),
  }
}

function prompt(output: Record<string, unknown>): Presented {
  return {
    title: 'Enhanced prompt',
    blocks: compact([
      output.prompt ? { type: 'quote', value: str(output.prompt) } : null,
      output.enhanced ? { type: 'quote', value: str(output.enhanced) } : null,
      { type: 'list', label: 'Variations', items: strings(output.variations) },
      output.notes ? { type: 'text', label: 'Notes', value: str(output.notes) } : null,
    ]),
  }
}

const PRESENTERS: Record<string, (output: Record<string, unknown>) => Presented> = {
  story_to_comic: comic,
  comic_to_video: video,
  cover_designer: cover,
  landing_page: landing,
  marketing_content: marketing,
  business_agent: business,
  prompt_enhancer: prompt,
}

/**
 * Present one stored run.
 *
 * Falls back to the raw payload rather than an empty card: an agent added
 * later, or a result whose shape changed, should still be readable and
 * downloadable instead of silently showing nothing.
 */
export function presentRun(
  agent: string,
  output: unknown,
  fallbackTitle = 'Result'
): Presented {
  if (!output || typeof output !== 'object') {
    return { title: fallbackTitle, blocks: [] }
  }

  const record = output as Record<string, unknown>
  const presenter = PRESENTERS[agent]

  if (!presenter) {
    return {
      title: str(record.title) || fallbackTitle,
      blocks: [{ type: 'raw', label: 'Result', value: JSON.stringify(output, null, 2) }],
    }
  }

  const presented = presenter(record)

  // A recognised agent whose payload did not match — better to show the
  // original than an empty card.
  if (presented.blocks.length === 0) {
    return {
      ...presented,
      blocks: [{ type: 'raw', label: 'Result', value: JSON.stringify(output, null, 2) }],
    }
  }

  return presented
}

/** What the customer typed, in words rather than as an object. */
export function presentInput(input: unknown): { name: string; value: string }[] {
  if (!input || typeof input !== 'object') return []

  const LABELS: Record<string, string> = {
    idea: 'Idea',
    pages: 'Pages',
    panelsPerPage: 'Panels per page',
    style: 'Art style',
    audience: 'Audience',
    niche: 'Niche',
    tone: 'Tone',
    prompt: 'Prompt',
    title: 'Title',
    aspect_ratio: 'Aspect ratio',
  }

  return Object.entries(input as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .filter(([, value]) => typeof value !== 'object')
    .slice(0, 10)
    .map(([key, value]) => ({
      name: LABELS[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      value: String(value),
    }))
}

/** Plain text, for the download button — readable rather than JSON. */
export function presentedToText(presented: Presented): string {
  const lines: string[] = [presented.title]

  if (presented.subtitle) lines.push(presented.subtitle)

  lines.push('')

  for (const block of presented.blocks) {
    if (block.type === 'text' || block.type === 'quote' || block.type === 'raw' || block.type === 'html') {
      if ('label' in block && block.label) lines.push(`## ${block.label}`)
      lines.push(block.value, '')
    } else if (block.type === 'list') {
      if (block.label) lines.push(`## ${block.label}`)
      lines.push(...block.items.map((item) => `- ${item}`), '')
    } else if (block.type === 'pairs') {
      if (block.label) lines.push(`## ${block.label}`)
      lines.push(...block.items.map((item) => `${item.name}: ${item.value}`), '')
    } else if (block.type === 'gallery') {
      if (block.label) lines.push(`## ${block.label}`)
      lines.push(...block.images.map((image) => image.url), '')
    } else if (block.type === 'pages') {
      if (block.label) lines.push(`## ${block.label}`)

      for (const page of block.pages) {
        lines.push(page.heading, ...page.lines.map((line) => `  ${line}`), '')
      }
    }
  }

  return lines.join('\n').trim()
}
