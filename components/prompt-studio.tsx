'use client'
import { consumeFeature } from '@/lib/plans/use-feature'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/db'
import {
  Sparkles,
  Search,
  Copy,
  Check,
  Wand2,
  Loader2,
  Library,
  ArrowRight,
  BookmarkPlus,
} from 'lucide-react'

interface LibraryPrompt {
  id: string
  category: string
  title: string
  prompt: string
  is_builtin: boolean
}

const CATEGORY_TONE: Record<string, string> = {
  Superhero: 'from-blue-500 to-indigo-600',
  Horror: 'from-slate-700 to-slate-900',
  Anime: 'from-pink-500 to-rose-600',
  Manga: 'from-zinc-600 to-zinc-800',
  Kids: 'from-amber-400 to-orange-500',
  Romance: 'from-rose-400 to-pink-600',
  Fantasy: 'from-violet-500 to-purple-700',
  Business: 'from-sky-500 to-blue-700',
  Motivation: 'from-emerald-500 to-teal-600',
  History: 'from-yellow-600 to-amber-700',
  'Sci-Fi': 'from-cyan-500 to-blue-600',
}

const ADDED_LABELS: Record<string, string> = {
  lighting: 'Lighting',
  camera: 'Camera',
  character: 'Character',
  environment: 'Environment',
  style: 'Art style',
  quality: 'Quality',
}

export function PromptStudio() {
  // --- Library state ---
  const [prompts, setPrompts] = useState<LibraryPrompt[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(true)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('All')
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // --- Enhancer state ---
  const [draft, setDraft] = useState('')
  const [enhancing, setEnhancing] = useState(false)
  const [enhanced, setEnhanced] = useState('')
  const [added, setAdded] = useState<Record<string, string>>({})
  const [enhanceError, setEnhanceError] = useState<string | null>(null)
  const [copiedEnhanced, setCopiedEnhanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('prompt_library')
          .select('id, category, title, prompt, is_builtin')
          .order('category')
          .order('title')

        if (error) throw error
        setPrompts(data || [])
      } catch (err: any) {
        // PGRST205 / 42P01 both mean the table is missing, i.e. the migration
        // in supabase/migrations/ has not been run yet. That is an expected
        // setup state rather than a fault, so it is not logged as an error.
        const missingTable =
          err?.code === 'PGRST205' ||
          err?.code === '42P01' ||
          /could not find the table|does not exist/i.test(err?.message ?? '')

        if (missingTable) {
          console.warn('[v0] prompt_library table missing — migration not run yet.')
        } else {
          console.error('[v0] Prompt library load error:', err)
        }

        setLibraryError(
          missingTable
            ? 'Database setup pending — run supabase/migrations/001_agent_foundation.sql in your Supabase SQL Editor, then refresh.'
            : 'Could not load the prompt library.'
        )
      } finally {
        setLoadingLibrary(false)
      }
    }

    load()
  }, [])

  const categories = useMemo(() => {
    const set = new Set(prompts.map((p) => p.category))
    return ['All', ...Array.from(set).sort()]
  }, [prompts])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return prompts.filter((p) => {
      const matchesCategory = category === 'All' || p.category === category
      const matchesQuery =
        !q || p.title.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [prompts, category, query])

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1600)
  }

  const enhance = async () => {
    const value = draft.trim()
    if (!value) return

    // Charged only once the input is valid — an empty submit would otherwise
    // cost one of the month's allowance and generate nothing.
    const allowance = await consumeFeature('prompt-studio')

    if (!allowance.ok) {
      setEnhanceError(allowance.error ?? 'Monthly limit reached')
      return
    }

    setEnhancing(true)
    setEnhanceError(null)
    setEnhanced('')
    setAdded({})
    setSavedNote(null)

    try {
      const res = await fetch('/api/agent/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: value }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data?.error || 'Enhancement failed')

      setEnhanced(data.enhanced)
      setAdded(data.added || {})
    } catch (err: any) {
      setEnhanceError(err.message || 'Something went wrong.')
    } finally {
      setEnhancing(false)
    }
  }

  const saveEnhanced = async () => {
    if (!enhanced) return
    setSaving(true)
    setSavedNote(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setSavedNote('Log in to save prompts.')
        return
      }

      const { data, error } = await supabase
        .from('prompt_library')
        .insert({
          user_id: user.id,
          category: 'My Prompts',
          title: draft.trim().slice(0, 60) || 'Saved prompt',
          prompt: enhanced,
          is_builtin: false,
        })
        .select('id, category, title, prompt, is_builtin')
        .single()

      if (error) throw error

      setPrompts((prev) => [...prev, data])
      setSavedNote('Saved to your library.')
    } catch (err: any) {
      console.error('[v0] Save prompt error:', err)
      setSavedNote(err?.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Prompt Studio</h1>
          <p className="text-sm text-slate-500">
            Ready-made prompts, plus an enhancer that turns a short idea into a detailed one
          </p>
        </div>
      </div>

      {/* ---------------- Enhancer ---------------- */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Wand2 className="w-[18px] h-[18px] text-white" />
          </div>
          <h2 className="font-display text-[17px] font-semibold text-slate-900">Prompt Enhancer</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5 ml-11.5">
          Adds lighting, camera angle, character detail, environment, art style and quality cues.
        </p>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Input */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Your prompt
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') enhance()
              }}
              placeholder="Ninja fighting."
              className="w-full h-36 rounded-xl bg-slate-50 p-3.5 outline-none resize-none text-slate-900 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all placeholder:text-slate-400"
            />

            <button
              onClick={enhance}
              disabled={enhancing || !draft.trim()}
              className="font-display mt-3 w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 disabled:shadow-none transition-all"
            >
              {enhancing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enhancing…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Enhance Prompt
                </>
              )}
            </button>
          </div>

          {/* Output */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Enhanced prompt
            </label>

            <div className="relative h-36 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3.5 overflow-y-auto">
              {enhanceError ? (
                <p className="text-sm text-rose-600">{enhanceError}</p>
              ) : enhanced ? (
                <p className="text-sm text-slate-800 leading-relaxed">{enhanced}</p>
              ) : (
                <p className="text-sm text-slate-400">
                  The detailed version will appear here.
                </p>
              )}
            </div>

            {enhanced && (
              <>
                {Object.keys(added).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.entries(added)
                      .filter(([, v]) => v)
                      .map(([key, value]) => (
                        <span
                          key={key}
                          title={value}
                          className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium"
                        >
                          {ADDED_LABELS[key] ?? key}
                        </span>
                      ))}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(enhanced)
                      setCopiedEnhanced(true)
                      setTimeout(() => setCopiedEnhanced(false), 1600)
                    }}
                    className="flex-1 h-10 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copiedEnhanced ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>

                  <button
                    onClick={saveEnhanced}
                    disabled={saving}
                    className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    )}
                    Save to library
                  </button>
                </div>

                {savedNote && (
                  <p className="text-[11px] text-slate-500 mt-2 text-center">{savedNote}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- Library ---------------- */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Library className="w-[18px] h-[18px] text-white" />
          </div>
          <h2 className="font-display text-[17px] font-semibold text-slate-900">Prompt Library</h2>
          {!loadingLibrary && !libraryError && (
            <span className="ml-auto text-[11px] font-medium text-slate-400">
              {filtered.length} of {prompts.length}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 mb-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-400 focus-within:bg-white transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none min-w-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ring-1 ${
                category === c
                  ? 'bg-slate-900 text-white ring-slate-900'
                  : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-400 hover:text-slate-900'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Results */}
        {loadingLibrary ? (
          <div className="py-14 flex flex-col items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <p className="text-sm text-slate-400">Loading prompts…</p>
          </div>
        ) : libraryError ? (
          <div className="py-12 px-6 text-center rounded-xl bg-amber-50 ring-1 ring-amber-200">
            <p className="text-sm text-amber-900 font-medium">{libraryError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            No prompts match your search.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="group rounded-xl ring-1 ring-slate-200 p-4 hover:ring-slate-300 hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold text-white bg-gradient-to-r ${
                      CATEGORY_TONE[p.category] ?? 'from-slate-500 to-slate-700'
                    }`}
                  >
                    {p.category}
                  </span>
                  {!p.is_builtin && (
                    <span className="text-[10px] font-medium text-slate-400">Yours</span>
                  )}
                </div>

                <h3 className="font-display font-semibold text-slate-900 text-sm mb-1.5">
                  {p.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed flex-1">{p.prompt}</p>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => copy(p.prompt, p.id)}
                    className="flex-1 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copiedId === p.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setDraft(p.prompt)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="flex-1 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    Enhance
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
