/**
 * Every string the customer-facing app shows, in English.
 *
 * This file is the source of truth. Translations are JSON files beside it in
 * `ui/`, keyed identically, and produced by `scripts/translate-ui.mjs` — so a
 * new string is added here once and the script fills in the rest.
 *
 * Deliberately flat. Nested groups read nicely and then make the translation
 * script, the fallback lookup and the missing-key report all more complicated
 * for no gain; the `area.thing` convention in the key gives the same grouping
 * where it is actually useful, which is when you are scanning this file.
 *
 * Not translated, on purpose:
 *
 *   - The three consoles. They are staff tools behind a role check, and an
 *     admin panel in a language the platform owner does not read is worse than
 *     one in English. Translating them would also more than double this file.
 *   - Anything the AI generates. That already follows the generation language,
 *     which is a separate choice — a customer may well want the interface in
 *     Hindi and the comic in English.
 *   - Brand names and plan names. "ComicAgent AI" is a name, not a phrase.
 */

export const CATALOG = {
  // ---- Navigation ----
  'nav.dashboard': 'Dashboard',
  'nav.group.agents': 'AI Agents',
  'nav.group.dfy': 'Done For You',
  'nav.group.create': 'Create',
  'nav.group.library': 'Library',
  'nav.group.account': 'Account',
  'nav.businessAgent': 'Business Agent',
  'nav.storyToComic': 'Story to Comic',
  'nav.comicToVideo': 'Comic to Video',
  'nav.coverDesigner': 'Cover Designer',
  'nav.landingPages': 'Landing Pages',
  'nav.marketing': 'Marketing',
  'nav.promptStudio': 'Prompt Studio',
  'nav.dfyBusinesses': 'DFY Businesses',
  'nav.autopilot': 'Autopilot',
  'nav.connections': 'Connections',
  'nav.comicGenerator': 'Comic Generator',
  'nav.coloringBook': 'Coloring Book',
  'nav.videoGenerator': 'Video Generator',
  'nav.bookCover': 'Book Cover',
  'nav.generatePrompt': 'Generate Prompt',
  'nav.myComics': 'My Comics',
  'nav.history': 'History',
  'nav.analytics': 'Analytics',
  'nav.dfyPacks': 'DFY Content Packs',
  'nav.myPlan': 'My Plan',
  'nav.myAiKeys': 'My AI Keys',
  'nav.reseller': 'Reseller',
  'nav.whiteLabel': 'White Label',
  'nav.support': 'Support',
  'nav.tagline': 'Create, Launch, Inspire.',
  'nav.lockedHint': 'Not included in your plan',
  'nav.openMenu': 'Open menu',
  'nav.closeMenu': 'Close menu',

  // ---- Dashboard ----
  'dash.overview': 'Overview',
  'dash.quickActions': 'Quick Actions',
  'dash.comics': 'Comics',
  'dash.coloringBooks': 'Coloring Books',
  'dash.videos': 'Videos',
  'dash.toolsUnlocked': 'Tools Unlocked',
  'dash.newComic.title': 'Create New Comic',
  'dash.newComic.subtitle': 'Write a story and generate full comic panels',
  'dash.coloring.title': 'Design Coloring Book',
  'dash.coloring.subtitle': 'Turn any story into printable coloring pages',
  'dash.library.title': 'Manage My Library',
  'dash.library.subtitle': 'View, edit and download your creations',

  // ---- Getting started ----
  'start.heading': 'Getting Started Guide',
  'start.step1.title': 'Describe Your Story',
  'start.step1.subtitle': 'Tell the AI what school adventure you want to tell',
  'start.step2.title': 'Choose an Art Style',
  'start.step2.subtitle': 'Comic cartoon, anime, watercolor and more',
  'start.step3.title': 'Generate & Download',
  'start.step3.subtitle': 'Get a print-ready comic or coloring book instantly',
  'start.cta': 'Start Creating Now',

  // ---- Language ----
  'lang.label': 'Language',
  'lang.interface': 'Interface language',
  'lang.content': 'Content language',
  'lang.contentHint': 'What language your comics and copy are written in.',
  'lang.interfaceHint': 'What language the app itself is shown in.',
  'lang.sameAsInterface': 'Same as the app',
  'lang.upgradeNote': '{count} more languages are on the higher tiers',
  // No placeholder: the singular is only ever used when the count is one, and
  // many languages render that as a word rather than a numeral — Arabic says
  // "لغة إضافية واحدة". Keeping {count} here asked translators to preserve a
  // token their language does not want, and the first one to drop it was right.
  'lang.upgradeNoteOne': 'One more language is on the higher tiers',
  'lang.seeUpgrade': 'see the upgrade',
  'lang.searchPlaceholder': 'Search languages…',
  'lang.partialWarning':
    'This language is not fully translated yet, so some of the app stays in English.',

  // ---- Common actions ----
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.download': 'Download',
  'common.close': 'Close',
  'common.search': 'Search',
  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.generate': 'Generate',
  'common.generating': 'Generating…',
  'common.somethingWrong': 'Something went wrong.',
  'common.networkError': 'Network error — please try again',
  'common.notSignedIn': 'Your session expired. Sign in again.',

  // ---- Library / quota ----
  'library.heading': 'My Library',
  'library.kept': '{used} of {limit} kept',
  'library.unlimited': '{used} kept · unlimited',
  'library.full': 'Your library is full',
  'library.fullHint': 'Remove something, or back it up, before saving more.',

  // ---- Plan ----
  'plan.label': 'Plan',
  'plan.none': 'No plan',
  'plan.upgrade': 'Upgrade',
  'plan.remaining': '{remaining} left this month',
  'plan.unlimited': 'Unlimited',
  'plan.exhausted': 'Monthly limit reached',
} as const

export type MessageKey = keyof typeof CATALOG

export const MESSAGE_KEYS = Object.keys(CATALOG) as MessageKey[]

/** Every string a translator has to produce, for the script and its report. */
export const SOURCE_STRINGS: Record<string, string> = CATALOG
