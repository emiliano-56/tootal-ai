import type { AgentDefinition, AgentId } from './types'

/**
 * Every agent the platform offers.
 *
 * `available: false` means the agent is defined but not implemented yet — the UI
 * shows it as "Coming soon" rather than pretending it works.
 */
export const AGENTS: Record<AgentId, AgentDefinition> = {
  story_to_comic: {
    id: 'story_to_comic',
    name: 'Story-to-Comic Agent',
    description:
      'Turns a single idea into a finished comic: story, scenes, panels, images, dialogue and speech bubbles.',
    steps: [
      { key: 'story', label: 'Writing the story' },
      { key: 'scenes', label: 'Splitting into scenes' },
      { key: 'panels', label: 'Designing panels' },
      { key: 'images', label: 'Generating artwork' },
      { key: 'dialogue', label: 'Writing dialogue' },
      { key: 'bubbles', label: 'Placing speech bubbles' },
      { key: 'export', label: 'Building the comic' },
    ],
    cost: (input) => Number(input.pages ?? 10) * 20,
    available: false,
  },

  comic_to_video: {
    id: 'comic_to_video',
    name: 'Comic-to-Video Agent',
    description:
      'Animates comic pages with camera moves, AI voice-over, music and captions.',
    steps: [
      { key: 'storyboard', label: 'Planning shots' },
      { key: 'voice', label: 'Generating voice-over' },
      { key: 'animate', label: 'Animating panels' },
      { key: 'mix', label: 'Adding music and captions' },
      { key: 'render', label: 'Rendering video' },
    ],
    cost: 150,
    // Needs server-side ffmpeg + TTS, which the current backend does not expose.
    available: false,
  },

  cover_designer: {
    id: 'cover_designer',
    name: 'Cover Designer Agent',
    description:
      'Designs front cover, spine and back cover with title, author, blurb, barcode and QR placeholders.',
    steps: [
      { key: 'concept', label: 'Choosing a concept' },
      { key: 'artwork', label: 'Generating artwork' },
      { key: 'blurb', label: 'Writing the back-cover blurb' },
      { key: 'compose', label: 'Composing the layout' },
      { key: 'export', label: 'Exporting print-ready files' },
    ],
    cost: 40,
    available: false,
  },

  landing_page: {
    id: 'landing_page',
    name: 'Landing Page Builder',
    description:
      'Generates a complete sales page — headline, features, benefits, FAQ, pricing and CTAs — with optional custom domain.',
    steps: [
      { key: 'copy', label: 'Writing the copy' },
      { key: 'sections', label: 'Building sections' },
      { key: 'assemble', label: 'Assembling the page' },
      { key: 'publish', label: 'Publishing' },
    ],
    cost: 30,
    available: false,
  },

  marketing_content: {
    id: 'marketing_content',
    name: 'Marketing Content Agent',
    description:
      'Produces ads, social captions, an email sequence, a blog article and SEO metadata.',
    steps: [
      { key: 'positioning', label: 'Working out the angle' },
      { key: 'ads', label: 'Writing ads' },
      { key: 'social', label: 'Writing social posts' },
      { key: 'email', label: 'Writing the email sequence' },
      { key: 'seo', label: 'Writing SEO copy' },
    ],
    cost: 25,
    available: false,
  },

  prompt_enhancer: {
    id: 'prompt_enhancer',
    name: 'Prompt Enhancer',
    description:
      'Expands a short prompt with lighting, camera angle, character detail, environment, art style and quality cues.',
    steps: [{ key: 'enhance', label: 'Enhancing the prompt' }],
    cost: 0,
    available: true,
  },

  business_agent: {
    id: 'business_agent',
    name: 'AI Business Agent',
    description:
      'One idea becomes a launch-ready package: comic, video, covers, mockups, sales page and all marketing assets.',
    steps: [
      { key: 'plan', label: 'Planning the product' },
      { key: 'comic', label: 'Creating the comic' },
      { key: 'covers', label: 'Designing covers' },
      { key: 'video', label: 'Producing the promo video' },
      { key: 'landing', label: 'Building the sales page' },
      { key: 'marketing', label: 'Writing marketing assets' },
      { key: 'package', label: 'Packaging downloads' },
    ],
    cost: 400,
    available: false,
  },
}

export const AGENT_LIST = Object.values(AGENTS)

export function getAgent(id: AgentId): AgentDefinition {
  return AGENTS[id]
}
