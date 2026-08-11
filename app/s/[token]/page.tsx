import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { resolveShare, countView } from '@/lib/share/links'
import { Flipbook } from '@/components/flipbook'

/**
 * The public page behind a share link.
 *
 * Reachable signed out — that is the whole point — so it renders from the
 * token alone and shows nothing but the one item. Its real job is the Open
 * Graph tags: every network fetches this page to build the preview card, and
 * without them a shared comic appears as a bare URL.
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const share = await resolveShare(token)

  if (!share) return { title: 'Not found' }

  // Only ever advertise something a network can actually draw. A comic is a
  // PDF and an episode is text; handing either to Facebook as og:image
  // produces a card with a broken picture in it, which looks worse than the
  // plain text card you get by saying nothing.
  const looksLikeImage = (value: string | null) =>
    Boolean(value && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value))

  const image =
    share.previewUrl ?? (looksLikeImage(share.url) ? (share.url as string) : undefined)

  const description = share.item.caption || `Made with ComicAgent AI`

  return {
    title: share.item.title,
    description,
    openGraph: {
      title: share.item.title,
      description,
      type: share.item.kind === 'video' ? 'video.other' : 'article',
      images: image ? [image] : undefined,
    },
    twitter: {
      // The large card is the difference between a thumbnail and something
      // worth stopping for.
      card: image ? 'summary_large_image' : 'summary',
      title: share.item.title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const share = await resolveShare(token)

  if (!share) notFound()

  // Counted after the page is known to render, and never allowed to throw.
  await countView(share.item.id, share.item.views)

  const { item, url } = share
  const isVideo = item.kind === 'video'
  const isPdf = Boolean(item.path?.endsWith('.pdf'))

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
        <header className="mb-8 text-center">
          <h1 className="font-display text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            {item.title}
          </h1>

          {item.caption && (
            <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {item.caption}
            </p>
          )}

          {item.hashtags.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {item.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-semibold"
                >
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="rounded-3xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 shadow-xl">
          {!url && item.body ? (
            // An Autopilot episode: the cover was drawn on the server, the
            // panels were not, so the page shows the cover and then the
            // episode as text.
            <div>
              {share.previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={share.previewUrl} alt={item.title} className="w-full" />
              )}

              <div className="p-6 sm:p-10">
                <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                  {item.body}
                </pre>
              </div>
            </div>
          ) : !url ? (
            <div className="p-16 text-center text-slate-500 dark:text-slate-400">
              This item is no longer available.
            </div>
          ) : isVideo ? (
            <video src={url} controls playsInline className="w-full bg-black" />
          ) : isPdf ? (
            // A reader rather than an <object>. Handing the PDF to the browser
            // gives a grey scrollbar on a desktop and a download prompt on
            // most phones — and a phone is where a shared link is opened.
            // The Flipbook falls back to the <object> if pdf.js cannot read it.
            <Flipbook url={url} title={item.title} downloadUrl={url} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={item.title} className="w-full" />
          )}
        </div>

        {url && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Open full size
            </a>
          </div>
        )}

        <footer className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600"
          >
            Made with <span className="font-bold text-indigo-600">ComicAgent AI</span>
          </Link>
        </footer>
      </div>
    </main>
  )
}
