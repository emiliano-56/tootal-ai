'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import { X, FileText, Loader2, Search } from 'lucide-react'
import { PdfThumbnail } from '@/components/pdf-thumbnail'

export interface LibraryItem {
  title: string
  pdf_path: string
  created_at: string
  type: 'comic' | 'coloring'
  signedUrl?: string
}

/**
 * Modal that lists the user's saved comics and coloring books so an existing
 * PDF can be reused without re-uploading it.
 */
export function LibraryPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (item: LibraryItem) => void
}) {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setError('Log in to see your saved comics.')
          return
        }

        const [comicsRes, coloringsRes] = await Promise.all([
          supabase
            .from('comics')
            .select('title, pdf_path, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('colorings')
            .select('title, pdf_path, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
        ])

        const all: LibraryItem[] = [
          ...(comicsRes.data ?? []).map((c: any) => ({ ...c, type: 'comic' as const })),
          ...(coloringsRes.data ?? []).map((c: any) => ({ ...c, type: 'coloring' as const })),
        ]
          .filter((c) => c.pdf_path)
          .sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )

        if (all.length > 0) {
          const { data: signed } = await supabase.storage
            .from('comic-pdfs')
            .createSignedUrls(
              all.map((a) => a.pdf_path),
              3600
            )

          const urlByPath = new Map(
            (signed ?? []).map((s) => [s.path, s.signedUrl] as const)
          )
          for (const item of all) {
            item.signedUrl = urlByPath.get(item.pdf_path) ?? undefined
          }
        }

        if (!cancelled) setItems(all)
      } catch (err: any) {
        if (!cancelled) {
          console.error('[library-picker] load failed:', err)
          setError('Could not load your library.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const filtered = query.trim()
    ? items.filter((i) => i.title?.toLowerCase().includes(query.trim().toLowerCase()))
    : items

  return (
    <div
      className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[82vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Import from My Library
            </h2>
            <p className="text-xs text-slate-500">
              Pick a comic you already made — its pages become video shots
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-pink-400 transition-all">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your comics…"
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none min-w-0"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-pink-600" />
              <p className="text-sm text-slate-400">Loading your library…</p>
            </div>
          ) : error ? (
            <p className="py-16 text-center text-sm text-slate-500">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">
                {items.length === 0
                  ? 'No saved comics yet. Create one first, then come back.'
                  : 'No comics match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filtered.map((item) => (
                <button
                  key={item.pdf_path}
                  onClick={() => onSelect(item)}
                  className="group text-left rounded-xl overflow-hidden ring-1 ring-slate-200 hover:ring-pink-400 hover:shadow-lg transition-all"
                >
                  <div className="aspect-[4/3] bg-slate-50 border-b border-slate-100">
                    <PdfThumbnail
                      url={item.signedUrl ?? null}
                      tone={item.type === 'comic' ? 'blue' : 'purple'}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
