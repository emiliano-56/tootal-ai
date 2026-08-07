/**
 * The social networks, and what each one actually lets you do.
 *
 * Two very different jobs share this catalogue:
 *
 *   - SHARING is a link the customer clicks. Every network below except two
 *     accepts a share URL with the link and text in the query string.
 *   - AUTO-POSTING is Autopilot publishing on their behalf, which needs an
 *     API, an app and a stored token.
 *
 * The differences are recorded honestly here rather than being discovered by a
 * customer who connected an account and waited for a post that could never
 * arrive. Instagram has no web share intent at all; Quora has no posting API.
 * Both facts are properties of those platforms, not gaps in this code.
 */

export type NetworkId =
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'linkedin'
  | 'telegram'
  | 'whatsapp'
  | 'quora'
  | 'reddit'

export interface Network {
  id: NetworkId
  label: string
  colour: string
  /** Can a link be handed off with a plain share URL? */
  canShare: boolean
  /** Can we publish on the customer's behalf once connected? */
  canAutoPost: boolean
  /**
   * How the connection is made.
   *
   * `oauth` needs an app registered with the platform; `token` is a secret the
   * customer pastes in, which is why Telegram works the day you buy it.
   */
  connect?: 'oauth' | 'token'
  /**
   * True when the platform makes you submit the app for human review before
   * it will post for real users. Shown on the connect screen, because it is
   * the difference between "works today" and "works in three weeks".
   */
  needsReview?: boolean
  /** Why a network cannot do something, in the customer's words. */
  note?: string
}

export const NETWORKS: Network[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    colour: '#1877f2',
    canShare: true,
    canAutoPost: true,
    connect: 'oauth',
    needsReview: true,
    note: 'Posts to a Facebook Page you manage, not to a personal profile — Meta does not allow the latter.',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    colour: '#e4405f',
    // Instagram has never had a web share intent. On a phone the operating
    // system's own share sheet reaches it; on a desktop nothing does.
    canShare: false,
    canAutoPost: true,
    connect: 'oauth',
    needsReview: true,
    note: 'Needs a Business or Creator account linked to a Facebook Page. On desktop, sharing by hand means downloading the image.',
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    colour: '#0f1419',
    canShare: true,
    canAutoPost: true,
    connect: 'oauth',
    note: 'Posting through the API is capped on X’s free tier — check your plan if a post is refused.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    colour: '#0a66c2',
    canShare: true,
    canAutoPost: true,
    connect: 'oauth',
    needsReview: true,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    colour: '#26a5e4',
    canShare: true,
    canAutoPost: true,
    // A bot token and a channel id. No app, no review, no waiting.
    connect: 'token',
    note: 'Works as soon as you paste a bot token — no developer app or approval needed.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    colour: '#25d366',
    canShare: true,
    canAutoPost: false,
    note: 'Sharing opens WhatsApp with the message ready. Automatic posting needs a WhatsApp Business account and template approval.',
  },
  {
    id: 'quora',
    label: 'Quora',
    colour: '#b92b27',
    // Quora publishes no share intent and no posting API.
    canShare: false,
    canAutoPost: false,
    note: 'Quora has no share link and no posting API. The button copies your caption and opens Quora so you can paste it.',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    colour: '#ff4500',
    canShare: true,
    canAutoPost: true,
    connect: 'oauth',
    note: 'Posts to a subreddit you choose. Most subreddits remove content that only promotes something — read the rules first.',
  },
]

export function network(id: string): Network | undefined {
  return NETWORKS.find((entry) => entry.id === id)
}

/** Networks a share button should be drawn for. */
export const SHAREABLE = NETWORKS.filter((entry) => entry.canShare || entry.id === 'quora')

/** Networks Autopilot can publish to once connected. */
export const POSTABLE = NETWORKS.filter((entry) => entry.canAutoPost)

export interface ShareTarget {
  /** The public link being shared. */
  url: string
  title: string
  /** The caption. Networks that take one put it before the link. */
  text?: string
  hashtags?: string[]
}

/**
 * The URL a share button opens.
 *
 * Returns null where the platform has no such thing, so the caller falls back
 * to copying rather than opening a page that cannot receive the share.
 */
export function shareUrl(id: NetworkId, target: ShareTarget): string | null {
  const url = encodeURIComponent(target.url)
  const title = encodeURIComponent(target.title)
  const caption = [target.text, ...(target.hashtags ?? []).map((tag) => `#${tag.replace(/^#/, '')}`)]
    .filter(Boolean)
    .join(' ')
  const text = encodeURIComponent(caption || target.title)

  switch (id) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`

    case 'twitter':
      return `https://twitter.com/intent/tweet?url=${url}&text=${text}`

    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`

    case 'telegram':
      return `https://t.me/share/url?url=${url}&text=${text}`

    case 'whatsapp':
      // WhatsApp takes one field, so the link goes on the end of the message.
      return `https://wa.me/?text=${encodeURIComponent(`${caption || target.title} ${target.url}`)}`

    case 'reddit':
      return `https://www.reddit.com/submit?url=${url}&title=${title}`

    case 'instagram':
    case 'quora':
      // Neither platform accepts a share URL. Handled by copy-and-open.
      return null

    default:
      return null
  }
}

/**
 * The caption to put on the clipboard for a network that cannot be handed a
 * link, and for the "copy caption" button generally.
 */
export function captionFor(target: ShareTarget): string {
  const tags = (target.hashtags ?? []).map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')

  return [target.text || target.title, tags, target.url].filter(Boolean).join('\n\n')
}

/** Where to send someone whose network cannot take a share link. */
export function fallbackUrl(id: NetworkId): string | null {
  if (id === 'quora') return 'https://www.quora.com/'
  if (id === 'instagram') return 'https://www.instagram.com/'

  return null
}

/**
 * Trim a caption to what a network will accept.
 *
 * X counts a link as 23 characters however long it is, so the room left for
 * words is smaller than a naive subtraction suggests.
 */
export function fitCaption(id: NetworkId, caption: string, hasLink = true): string {
  const limits: Partial<Record<NetworkId, number>> = {
    twitter: 280,
    instagram: 2200,
    facebook: 63206,
    linkedin: 3000,
    telegram: 1024,
    reddit: 40000,
  }

  const limit = limits[id]

  if (!limit) return caption

  const room = hasLink && id === 'twitter' ? limit - 24 : limit

  if (caption.length <= room) return caption

  return `${caption.slice(0, Math.max(0, room - 1)).trimEnd()}…`
}
