/**
 * The shape of a Done For You pack.
 *
 * A niche is a folder of assets of eight kinds. What each kind is called, which
 * tool finishes it and which marketplace it sells on lives here rather than
 * being repeated in the screen, so adding a kind is one edit.
 */

export type AssetKind =
  | 'website'
  | 'storybook'
  | 'video'
  | 'rhyme'
  | 'printable'
  | 'tutor'
  | 'blog'
  | 'listing'

export interface AssetKindInfo {
  kind: AssetKind
  label: string
  plural: string
  /** What this is, in the words a customer would use. */
  hint: string
  /** Route of the tool that turns `prompt` into a finished asset. */
  tool?: string
  toolLabel?: string
  /** File extension used when the body is downloaded. */
  extension: string
  mime: string
}

export const ASSET_KINDS: AssetKindInfo[] = [
  {
    kind: 'website',
    label: 'Website',
    plural: 'Website',
    hint: 'A complete one-page site. Change the buy link and upload it.',
    extension: 'html',
    mime: 'text/html',
  },
  {
    kind: 'storybook',
    label: 'Storybook',
    plural: 'Storybooks',
    hint: 'Full story, beat sheet and character sheet, ready to illustrate.',
    tool: '/comic-agent',
    toolLabel: 'Story to Comic',
    extension: 'md',
    mime: 'text/markdown',
  },
  {
    kind: 'video',
    label: 'Video script',
    plural: 'Video scripts',
    hint: 'A narrated episode with a scene prompt for every shot.',
    tool: '/comic-video',
    toolLabel: 'Comic to Video',
    extension: 'md',
    mime: 'text/markdown',
  },
  {
    kind: 'rhyme',
    label: 'Rhyme',
    plural: 'Rhymes',
    hint: 'Original lyrics, free of copyright, with a suggested melody.',
    tool: '/video',
    toolLabel: 'Video Generator',
    extension: 'md',
    mime: 'text/markdown',
  },
  {
    kind: 'printable',
    label: 'Printables',
    plural: 'Printables',
    hint: 'Colouring pages and worksheets, sized for A4 and US Letter.',
    tool: '/coloring',
    toolLabel: 'Colouring Book',
    extension: 'md',
    mime: 'text/markdown',
  },
  {
    kind: 'tutor',
    label: 'AI tutor',
    plural: 'AI tutor',
    hint: 'An in-character tutor, with the system prompt that runs it.',
    tool: '/chat',
    toolLabel: 'Generate Prompt',
    extension: 'md',
    mime: 'text/markdown',
  },
  {
    kind: 'blog',
    label: 'Blog post',
    plural: 'Blog content',
    hint: 'A finished article, written to be found in search.',
    extension: 'md',
    mime: 'text/markdown',
  },
  {
    kind: 'listing',
    label: 'Listings',
    plural: 'Marketplace listings',
    hint: 'Titles, descriptions, keywords and pricing for each marketplace.',
    extension: 'md',
    mime: 'text/markdown',
  },
]

export function kindInfo(kind: string): AssetKindInfo {
  return (
    ASSET_KINDS.find((entry) => entry.kind === kind) ?? {
      kind: kind as AssetKind,
      label: kind,
      plural: kind,
      hint: '',
      extension: 'txt',
      mime: 'text/plain',
    }
  )
}

export const MARKETPLACES: { id: string; label: string; colour: string }[] = [
  { id: 'kdp', label: 'Amazon KDP', colour: '#ff9900' },
  { id: 'etsy', label: 'Etsy', colour: '#f56400' },
  { id: 'gumroad', label: 'Gumroad', colour: '#ff90e8' },
  { id: 'youtube', label: 'YouTube', colour: '#ff0000' },
]

export function marketplaceLabel(id: string): string {
  return MARKETPLACES.find((entry) => entry.id === id)?.label ?? id
}

export interface DfyAsset {
  id: string
  kind: string
  title: string
  summary: string
  body: string
  prompt: string | null
  tool: string | null
  meta: Record<string, unknown>
  marketplaces: string[]
  sortOrder: number
}

export interface DfyNiche {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  audience: string
  emoji: string
  colourFrom: string
  colourTo: string
  keywords: string[]
}

/**
 * Assets arranged for the screen: one group per kind, in the order the kinds
 * are declared, and empty groups dropped.
 *
 * Ordered by the catalogue rather than by whatever the database returned, so a
 * pack whose rows were edited does not reshuffle its own tabs.
 */
export function groupByKind(assets: DfyAsset[]): { info: AssetKindInfo; assets: DfyAsset[] }[] {
  return ASSET_KINDS.map((info) => ({
    info,
    assets: assets
      .filter((asset) => asset.kind === info.kind)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((group) => group.assets.length > 0)
}

/** Where a "finish this" button should send the customer, with the prompt. */
export function toolLinkFor(asset: DfyAsset): { href: string; label: string } | null {
  const route = asset.tool ? `/${asset.tool.replace(/^\//, '')}` : kindInfo(asset.kind).tool

  if (!route || !asset.prompt) return null

  const label = kindInfo(asset.kind).toolLabel ?? 'Open'

  // The prompt travels in the query so the tool can prefill; it is the same
  // text the customer can already read on screen, so nothing is exposed.
  return { href: `${route}?prompt=${encodeURIComponent(asset.prompt)}`, label: `Open in ${label}` }
}

/** A safe download name: "bedtime-animal-tales-the-night-the-stars.md". */
export function downloadName(niche: DfyNiche, asset: DfyAsset): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)

  return `${slug(niche.slug)}-${slug(asset.title)}.${kindInfo(asset.kind).extension}`
}

/** What the niche card shows: "9 assets · 4 marketplaces". */
export function summarise(assets: DfyAsset[]): { assets: number; marketplaces: string[] } {
  const marketplaces = new Set<string>()

  for (const asset of assets) {
    for (const id of asset.marketplaces) marketplaces.add(id)
  }

  return {
    assets: assets.length,
    // Catalogue order, so the badges do not jump between packs.
    marketplaces: MARKETPLACES.filter((entry) => marketplaces.has(entry.id)).map(
      (entry) => entry.id
    ),
  }
}
