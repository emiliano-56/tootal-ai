'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Film,
  Upload,
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  Sparkles,
  FolderOpen,
  FileText,
  Wand2,
  Music,
  Video as VideoIcon,
  ImageIcon,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  renderVideo,
  isSupported,
  ASPECTS,
  autoMove,
  type AspectKey,
  type CameraMove,
  type Shot,
} from '@/lib/video/composer'
import { renderPdfToImages, fileToArrayBuffer } from '@/lib/pdf/client'
import { LibraryPicker, type LibraryItem } from '@/components/library-picker'
import { supabase } from '@/lib/db'
import { AgentHeader, Card, PrimaryButton, ErrorNote, Field, inputClass } from '@/components/agent-ui'

import { useGenerationApi } from '@/components/generation-config'
import { consumeFeature } from '@/lib/plans/use-feature'
import { useLanguage, LanguagePicker } from '@/components/language-picker'
import { MusicPicker } from '@/components/music-picker'
import { totalSeconds, type Direction } from '@/lib/video/director'
import { toSrt, toScript, cuesFrom, overrunningShots } from '@/lib/video/narration'
import { speak, stopSpeaking, checkSpeech } from '@/lib/audio/speech'
import { narrationScript } from '@/lib/video/director'

const MOVES: { value: CameraMove; label: string }[] = [
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
  { value: 'pan-left', label: 'Pan Left' },
  { value: 'pan-right', label: 'Pan Right' },
  { value: 'pan-up', label: 'Pan Up' },
  { value: 'pan-down', label: 'Pan Down' },
]

interface EditableShot extends Shot {
  id: string
  name: string
  /** Still kept after a clip is generated, so the tile can show a poster. */
  poster?: string
  clipStatus?: 'idle' | 'generating' | 'ready' | 'failed'
  clipError?: string
  /** Why the director chose this move — worth reading, so it is shown. */
  intent?: string
}

export function ComicVideoStudio() {
  const API = useGenerationApi()

  const [supported, setSupported] = useState(true)
  const [shots, setShots] = useState<EditableShot[]>([])
  const [aspect, setAspect] = useState<AspectKey>('landscape')
  const [withAudio, setWithAudio] = useState(true)

  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  const [importing, setImporting] = useState(false)
  const [importLabel, setImportLabel] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const [storyContext, setStoryContext] = useState('')
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoLabel, setAutoLabel] = useState('')

  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [musicName, setMusicName] = useState('')
  const [musicCredit, setMusicCredit] = useState('')
  const [showMusic, setShowMusic] = useState(false)

  // The narration language. Empty directive for English, so nothing changes
  // for a customer who never touches it.
  const language = useLanguage('comictale-video-language')

  const [directing, setDirecting] = useState(false)
  const [direction, setDirection] = useState<Direction | null>(null)

  // Narration is previewed aloud rather than mixed into the export: the browser
  // will happily speak it, but `speechSynthesis` exposes no audio stream, so
  // there is nothing to route into the recorder. The words still reach the
  // finished video as burned-in captions, and leave as a subtitle file.
  const [speaking, setSpeaking] = useState(false)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const musicRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const objectUrls = useRef<string[]>([])

  useEffect(() => {
    setSupported(isSupported())
  }, [])

  // Release every object URL this component created.
  useEffect(() => {
    return () => {
      objectUrls.current.forEach((u) => URL.revokeObjectURL(u))
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const trackUrl = (url: string) => {
    objectUrls.current.push(url)
    return url
  }

  const update = (id: string, patch: Partial<EditableShot>) =>
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const remove = (id: string) => setShots((prev) => prev.filter((s) => s.id !== id))

  const makeShot = (image: string, name: string, index: number): EditableShot => ({
    id: `${name}-${Date.now()}-${index}-${Math.random()}`,
    name,
    kind: 'image',
    src: image,
    caption: '',
    duration: 4,
    move: autoMove(index),
    clipStatus: 'idle',
  })

  const appendImages = (images: string[], prefix: string) =>
    setShots((prev) => [
      ...prev,
      ...images.map((img, i) => makeShot(img, `${prefix} — page ${i + 1}`, prev.length + i)),
    ])

  /** Accepts PNG / JPG images and multi-page PDFs. */
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return

    setError(null)
    setImporting(true)

    try {
      const collected: { image: string; name: string }[] = []

      for (const file of Array.from(files)) {
        const isPdf =
          file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

        if (isPdf) {
          setImportLabel(`Reading ${file.name}…`)
          const buffer = await fileToArrayBuffer(file)
          const pages = await renderPdfToImages(new Uint8Array(buffer), {
            onProgress: (done, total) =>
              setImportLabel(`${file.name} — page ${done} of ${total}`),
          })
          const base = file.name.replace(/\.pdf$/i, '')
          pages.forEach((image, i) =>
            collected.push({ image, name: `${base} — page ${i + 1}` })
          )
          continue
        }

        if (!file.type.startsWith('image/')) continue

        setImportLabel(`Adding ${file.name}…`)
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
        collected.push({ image: dataUrl, name: file.name })
      }

      if (collected.length === 0) {
        setError('No usable pages found. Add PNG, JPG or PDF files.')
        return
      }

      setShots((prev) => [
        ...prev,
        ...collected.map((c, i) => makeShot(c.image, c.name, prev.length + i)),
      ])
    } catch (err: any) {
      console.error('[comic-video] import failed:', err)
      setError(err?.message || 'Could not read those files.')
    } finally {
      setImporting(false)
      setImportLabel('')
    }
  }

  const importFromLibrary = async (item: LibraryItem) => {
    setPickerOpen(false)
    if (!item.signedUrl) {
      setError('That comic could not be opened. Try again.')
      return
    }

    setError(null)
    setImporting(true)
    setImportLabel(`Opening ${item.title}…`)

    try {
      const pages = await renderPdfToImages(item.signedUrl, {
        onProgress: (done, total) =>
          setImportLabel(`${item.title} — page ${done} of ${total}`),
      })
      if (pages.length === 0) {
        setError('That comic has no readable pages.')
        return
      }
      appendImages(pages, item.title)
      if (!storyContext) setStoryContext(item.title)
    } catch (err: any) {
      console.error('[comic-video] library import failed:', err)
      setError(err?.message || 'Could not read that comic.')
    } finally {
      setImporting(false)
      setImportLabel('')
    }
  }

  /**
   * Generates a real AI video clip for one shot using the same backend the
   * Video Generator uses, then swaps the still for the clip.
   */
  const generateClip = async (shot: EditableShot, promptOverride?: string) => {
    const prompt = (promptOverride ?? shot.caption ?? '').trim() || storyContext.trim()

    if (!prompt) {
      update(shot.id, {
        clipStatus: 'failed',
        clipError: 'Add a caption or story context first.',
      })
      return false
    }

    // Charged only once the input is valid — a shot with no caption would
    // otherwise cost one of the month's allowance and generate nothing.
    const allowance = await consumeFeature('comic-video')

    if (!allowance.ok) {
      update(shot.id, {
        clipStatus: 'failed',
        clipError: allowance.error ?? 'Monthly limit reached',
      })
      return false
    }

    update(shot.id, { clipStatus: 'generating', clipError: undefined })

    try {
      const res = await fetch(`${API}/text-video/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          audio: withAudio,
          aspect_ratio: ASPECTS[aspect].ratio,
          duration_type: '8s',
        }),
      })

      const data = await res.json()
      if (!res.ok || !data?.download_url) {
        throw new Error(data?.detail || 'Clip generation failed')
      }

      // Fetch to a blob so the canvas is never tainted by a cross-origin frame.
      const blob = await (await fetch(data.download_url)).blob()
      const objectUrl = trackUrl(URL.createObjectURL(blob))

      update(shot.id, {
        kind: 'video',
        src: objectUrl,
        poster: shot.poster ?? (shot.kind === 'image' ? shot.src : undefined),
        clipStatus: 'ready',
      })
      return true
    } catch (err: any) {
      console.error('[comic-video] clip failed:', err)
      update(shot.id, {
        clipStatus: 'failed',
        clipError: err?.message || 'Clip generation failed',
      })
      return false
    }
  }

  /** Writes shot captions with AI, then generates a clip for every shot. */
/**
   * Let the AI direct the edit.
   *
   * This is the difference between a video and a slideshow with effects on it.
   * The model reads the panels in order and decides how long each one holds,
   * which way the camera moves and why, and what the narrator says over it —
   * rather than the customer picking "Zoom In" from a dropdown for every panel
   * and typing a prompt by hand.
   *
   * Applied to the shots already on the timeline, so it costs nothing to try
   * and can be run again after reordering.
   */
  const directEdit = async () => {
    if (shots.length === 0) return

    setDirecting(true)
    setError(null)

    try {
      const res = await fetch('/api/agent/video-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Comic video',
          // .value, not the hook — the whole object stringifies to
          // "[object Object]", which no language lookup matches, so the
          // directive came out empty and every narration was English.
          language: language.value,
          audience: 'children',
          panels: shots.map((shot) => ({ caption: shot.caption, scene: shot.name })),
        }),
      })

      const data = await res.json()
      const direction: Direction | undefined = data?.direction

      if (!direction?.shots?.length) throw new Error(data?.error || 'The director returned nothing')

      // Rebuilt from the shot list rather than patched onto it: the director
      // may hold on a panel twice, or drop one that adds nothing.
      const rebuilt: EditableShot[] = direction.shots
        .map((cut, index) => {
          const source = shots[cut.panel]

          if (!source) return null

          return {
            ...source,
            id: `${source.id}-${index}`,
            duration: cut.seconds,
            move: cut.move,
            caption: cut.narration || source.caption,
            intent: cut.intent,
          }
        })
        .filter(Boolean) as EditableShot[]

      setShots(rebuilt)
      setDirection(direction)

      if (data.fellBack) setError(data.reason ?? null)
    } catch (err: any) {
      setError(err?.message || 'Could not direct the edit.')
    } finally {
      setDirecting(false)
    }
  }

  /** Read the whole narration aloud, in the chosen language. */
  const previewNarration = async () => {
    if (!direction) return

    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }

    const check = await checkSpeech(language.value)

    // A missing voice is worth saying rather than reading Hindi with an
    // English voice, which is unintelligible rather than merely accented.
    setVoiceNote(check.message ?? null)

    if (!check.voice) return

    await speak(narrationScript(direction), {
      language: language.value,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: (message) => {
        setSpeaking(false)
        setVoiceNote(message)
      },
    })
  }

  const downloadNarration = (kind: 'srt' | 'txt') => {
    if (!direction) return

    const body = kind === 'srt' ? toSrt(direction) : toScript(direction)
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `${(direction.title || 'narration').replace(/[^\w-]+/g, '-').toLowerCase()}.${kind}`
    link.click()

    URL.revokeObjectURL(url)
  }

  // Stop the voice if the customer navigates away mid-sentence — it keeps
  // talking otherwise, with nothing left on screen to stop it.
  useEffect(() => () => stopSpeaking(), [])

  const autoDirect = async () => {
    if (shots.length === 0) return

    setAutoRunning(true)
    setError(null)

    try {
      setAutoLabel('Writing shot list…')

      const res = await fetch('/api/agent/scene-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: storyContext,
          pages: shots.map((s) => s.caption || s.name),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not plan the shots')

      const scenes: { prompt: string; caption: string }[] = data.scenes ?? []

      // Apply captions immediately so progress is visible.
      const withCaptions = shots.map((s, i) => ({
        ...s,
        caption: scenes[i]?.caption || s.caption,
      }))
      setShots(withCaptions)

      for (let i = 0; i < withCaptions.length; i++) {
        setAutoLabel(`Generating clip ${i + 1} of ${withCaptions.length}…`)
        await generateClip(withCaptions[i], scenes[i]?.prompt)
      }

      setAutoLabel('')
    } catch (err: any) {
      setError(err?.message || 'Auto-direct failed.')
    } finally {
      setAutoRunning(false)
      setAutoLabel('')
    }
  }

  const totalDuration = shots.reduce(
    (sum, s) => sum + (s.kind === 'video' ? 8 : (s.duration ?? 4)),
    0
  )
  const clipCount = shots.filter((s) => s.kind === 'video').length

  const render = async () => {
    if (shots.length === 0) return

    setRendering(true)
    setError(null)
    setProgress(0)
    setSavedNote(null)

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
      setVideoUrl(null)
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const { width, height } = ASPECTS[aspect]
      const blob = await renderVideo(shots, {
        width,
        height,
        fps: 30,
        musicSrc: musicUrl ?? undefined,
        onProgress: (fraction, label) => {
          setProgress(fraction)
          setProgressLabel(label)
        },
        signal: controller.signal,
      })

      setVideoUrl(URL.createObjectURL(blob))
      setProgressLabel('Done')
    } catch (err: any) {
      if (err?.message !== 'Cancelled') setError(err.message || 'Rendering failed.')
    } finally {
      setRendering(false)
      abortRef.current = null
    }
  }

  const saveToLibrary = async () => {
    if (!videoUrl) return
    setSaving(true)
    setSavedNote(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setSavedNote('Log in to save to your library.')
        return
      }

      const blob = await (await fetch(videoUrl)).blob()
      const path = `${user.id}/comic-video-${Date.now()}.webm`

      const { error: upErr } = await supabase.storage
        .from('video')
        .upload(path, blob, { contentType: 'video/webm' })

      if (upErr) throw upErr
      setSavedNote('Saved to My Library.')
    } catch (err: any) {
      console.error('[comic-video] save failed:', err)
      setSavedNote(err?.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  const busy = importing || autoRunning || rendering

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<Film className="w-5 h-5 text-white" />}
        gradient="from-pink-500 to-rose-600"
        title="Comic-to-Video Agent"
        subtitle="Turn comic pages into a real video — AI motion clips, captions and sound"
      />

      {!supported && (
        <ErrorNote message="This browser cannot record canvas video. Please use Chrome, Edge or Firefox." />
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <Card
            title="Timeline"
            subtitle={
              shots.length > 0
                ? `${shots.length} shots · ${clipCount} AI clips · ~${Math.round(totalDuration)}s`
                : 'Add pages, then let AI turn them into moving shots'
            }
            right={
              <div className="flex gap-2">
                <button
                  onClick={() => setPickerOpen(true)}
                  disabled={busy}
                  className="h-9 px-3.5 rounded-lg bg-white ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Library
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </button>
              </div>
            }
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />

            {(importing || autoRunning) && (
              <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-pink-50 ring-1 ring-pink-200 px-3.5 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-pink-600 shrink-0" />
                <p className="text-xs text-pink-900">
                  {importLabel || autoLabel || 'Working…'}
                </p>
              </div>
            )}

            {shots.length === 0 && !importing ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="py-14 rounded-xl border-2 border-dashed border-slate-200 hover:border-pink-300 hover:bg-pink-50/40 transition-colors flex flex-col items-center gap-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center px-4">
                    <p className="font-display font-semibold text-slate-900">Upload files</p>
                    <p className="text-xs text-slate-500 mt-0.5">PNG, JPG or multi-page PDF</p>
                  </div>
                </button>

                <button
                  onClick={() => setPickerOpen(true)}
                  className="py-14 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors flex flex-col items-center gap-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center px-4">
                    <p className="font-display font-semibold text-slate-900">Use a saved comic</p>
                    <p className="text-xs text-slate-500 mt-0.5">Import one you already made</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {shots.map((shot, i) => (
                  <div key={shot.id} className="flex gap-3 rounded-xl ring-1 ring-slate-200 p-3">
                    <div className="relative w-24 h-24 shrink-0">
                      <img
                        src={shot.kind === 'video' ? (shot.poster ?? shot.src) : shot.src}
                        alt={shot.name}
                        className="w-24 h-24 object-cover rounded-lg bg-slate-100"
                      />
                      {shot.kind === 'video' && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-pink-600 text-white text-[9px] font-bold inline-flex items-center gap-1">
                          <VideoIcon className="w-2.5 h-2.5" />
                          CLIP
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 text-[10px] font-bold">
                          Shot {i + 1}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate">{shot.name}</span>
                        <button
                          onClick={() => remove(shot.id)}
                          disabled={busy}
                          className="ml-auto text-slate-300 hover:text-rose-600 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        value={shot.caption ?? ''}
                        onChange={(e) => update(shot.id, { caption: e.target.value })}
                        placeholder="What happens in this shot (also used as the AI prompt)"
                        className="w-full rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-pink-400 focus:bg-white outline-none transition-all placeholder:text-slate-400"
                      />

                      <div className="flex gap-2 items-center">
                        {shot.kind === 'image' ? (
                          <>
                            <select
                              value={shot.move}
                              onChange={(e) =>
                                update(shot.id, { move: e.target.value as CameraMove })
                              }
                              className="flex-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200 outline-none"
                            >
                              {MOVES.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={shot.duration}
                              onChange={(e) =>
                                update(shot.id, { duration: Number(e.target.value) })
                              }
                              className="w-20 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200 outline-none"
                            >
                              {[2, 3, 4, 5, 6, 8].map((d) => (
                                <option key={d} value={d}>
                                  {d}s
                                </option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <span className="flex-1 text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 font-medium">
                            AI clip ready · 8s with motion
                          </span>
                        )}

                        <button
                          onClick={() => generateClip(shot)}
                          disabled={busy || shot.clipStatus === 'generating'}
                          title="Generate an AI motion clip for this shot"
                          className="h-[30px] px-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-all shrink-0"
                        >
                          {shot.clipStatus === 'generating' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Wand2 className="w-3 h-3" />
                          )}
                          {shot.kind === 'video' ? 'Redo' : 'Animate'}
                        </button>
                      </div>

                      {shot.clipStatus === 'failed' && shot.clipError && (
                        <p className="text-[11px] text-rose-600">{shot.clipError}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {videoUrl && (
            <Card
              title="Your video"
              right={
                <div className="flex gap-2">
                  <button
                    onClick={saveToLibrary}
                    disabled={saving}
                    className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Save to library
                  </button>
                  <a
                    href={videoUrl}
                    download={`comic-video-${aspect}.webm`}
                    className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </a>
                </div>
              }
            >
              <video src={videoUrl} controls className="w-full rounded-xl bg-black max-h-[520px]" />
              {savedNote && (
                <p className="text-[11px] text-slate-500 mt-2 text-center">{savedNote}</p>
              )}
            </Card>
          )}
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <Card title="Auto-direct" subtitle="AI writes the shots and animates every page">
            <Field label="Story context">
              <textarea
                value={storyContext}
                onChange={(e) => setStoryContext(e.target.value)}
                placeholder="A robot defends a neon city from an alien invasion."
                className={`${inputClass} h-20 resize-none`}
              />
            </Field>

            <PrimaryButton
              onClick={autoDirect}
              loading={autoRunning}
              disabled={shots.length === 0 || busy}
              gradient="from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700"
              shadow="shadow-pink-500/25"
              className="w-full mt-3"
            >
              {!autoRunning && <Sparkles className="w-4 h-4" />}
              {autoRunning ? 'Directing…' : 'Auto-direct all shots'}
            </PrimaryButton>

            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Generates one 8-second AI clip per page. {shots.length} pages ≈{' '}
              {shots.length * 8}s of footage — this takes a while.
            </p>
          </Card>

          <Card title="Output format">
            <div className="space-y-2">
              {(Object.keys(ASPECTS) as AspectKey[]).map((key) => {
                const a = ASPECTS[key]
                const selected = aspect === key
                return (
                  <button
                    key={key}
                    onClick={() => setAspect(key)}
                    className={`w-full flex items-center gap-3 rounded-xl p-3 ring-1 transition-all ${
                      selected
                        ? 'bg-pink-50 ring-2 ring-pink-500'
                        : 'bg-white ring-slate-200 hover:ring-slate-300'
                    }`}
                  >
                    <div
                      className={`rounded shrink-0 ${
                        selected ? 'bg-gradient-to-br from-pink-500 to-rose-600' : 'bg-slate-200'
                      }`}
                      style={{
                        width: key === 'vertical' ? 18 : 32,
                        height: key === 'vertical' ? 32 : key === 'square' ? 32 : 18,
                      }}
                    />
                    <div className="text-left min-w-0">
                      <p
                        className={`text-sm font-semibold ${selected ? 'text-pink-700' : 'text-slate-900'}`}
                      >
                        {a.label}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {a.width}×{a.height}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card title="Sound">
            <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={withAudio}
                onChange={(e) => setWithAudio(e.target.checked)}
                className="w-4 h-4 rounded accent-pink-600"
              />
              <span className="text-sm text-slate-700">AI clips include audio</span>
            </label>

            {/* Directing the edit — the thing that separates a video from a
                slideshow with effects on it. */}
            <div className="mb-4 rounded-xl ring-1 ring-indigo-200 bg-indigo-50/50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-indigo-900">AI Director</p>
                  <p className="text-[11px] text-indigo-700/80">
                    Reads your panels and decides the pacing, the camera and the narration.
                  </p>
                </div>

                <button
                  onClick={directEdit}
                  disabled={directing || shots.length === 0}
                  className="h-9 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  {directing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Directing…
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5" />
                      Direct this
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3">
                <LanguagePicker
                  value={language.value}
                  onChange={language.setValue}
                  allowed={language.allowed}
              answered={language.answered}
                />
              </div>

              {direction && (
                <div className="mt-3 pt-3 border-t border-indigo-200/70 space-y-1">
                  <p className="text-[11px] text-indigo-900">
                    <span className="font-semibold">{direction.treatment}</span>
                  </p>
                  <p className="text-[11px] text-indigo-700/80">
                    {direction.shots.length} shots · {totalSeconds(direction)}s · music:{' '}
                    {direction.musicMood} · voice: {direction.voiceStyle}
                  </p>
                </div>
              )}
            </div>

            {/* Narration.
                Kept honest about what it can and cannot do: the browser will
                read the script aloud for free in any of these languages, but
                `speechSynthesis` gives back no audio stream, so there is
                nothing to mix into the recording. The words reach the video as
                burned-in captions, and leave as a subtitle file the customer
                can use anywhere. */}
            {direction && cuesFrom(direction).length > 0 && (
              <div className="mb-4 rounded-xl ring-1 ring-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">Narration</p>
                    <p className="text-[11px] text-slate-500">
                      {cuesFrom(direction).length} lines · burned into the video as captions
                    </p>
                  </div>

                  <button
                    onClick={previewNarration}
                    className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                  >
                    {speaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        Listen
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadNarration('srt')}
                    className="h-8 px-3 rounded-lg ring-1 ring-slate-200 bg-white text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    Subtitles (.srt)
                  </button>

                  <button
                    onClick={() => downloadNarration('txt')}
                    className="h-8 px-3 rounded-lg ring-1 ring-slate-200 bg-white text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    Script
                  </button>
                </div>

                {voiceNote && (
                  <p className="mt-2.5 text-[11px] text-amber-700 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                    {voiceNote}
                  </p>
                )}

                {/* A model asked for atmosphere will write two sentences over a
                    two-second shot. Better said now than discovered when the
                    voice is still talking over the next scene. */}
                {overrunningShots(direction).length > 0 && (
                  <p className="mt-2 text-[11px] text-amber-700 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                    {overrunningShots(direction).length} shot
                    {overrunningShots(direction).length === 1 ? ' has' : 's have'} more narration
                    than fits — lengthen {overrunningShots(direction).length === 1 ? 'it' : 'them'}{' '}
                    or trim the words.
                  </p>
                )}
              </div>
            )}

            <input
              ref={musicRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  if (musicUrl) URL.revokeObjectURL(musicUrl)
                  setMusicUrl(trackUrl(URL.createObjectURL(file)))
                  setMusicName(file.name)
                }
                e.target.value = ''
              }}
            />

            <button
              onClick={() => setShowMusic(true)}
              className="mt-2 w-full h-9 rounded-lg ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Music className="w-3.5 h-3.5 text-pink-600" />
              Find copyright-free music
            </button>

            {musicCredit && (
              <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
                <span className="font-semibold text-slate-700">Credit required:</span> {musicCredit}
              </p>
            )}

            {musicUrl ? (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
                <Music className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                <span className="text-xs text-slate-700 truncate flex-1">{musicName}</span>
                <button
                  onClick={() => {
                    if (musicUrl) URL.revokeObjectURL(musicUrl)
                    setMusicUrl(null)
                    setMusicName('')
                  }}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => musicRef.current?.click()}
                className="mt-2 w-full h-9 rounded-lg bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Music className="w-3.5 h-3.5" />
                Add background music
              </button>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3.5 py-2.5 ring-1 ring-slate-200 mb-4">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                {shots.length - clipCount}
                <VideoIcon className="w-3.5 h-3.5 ml-1.5" />
                {clipCount}
              </span>
              <span className="font-semibold text-pink-600">~{Math.round(totalDuration)}s</span>
            </div>

            <PrimaryButton
              onClick={render}
              loading={rendering}
              disabled={shots.length === 0 || !supported || busy}
              gradient="from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700"
              shadow="shadow-pink-500/25"
              className="w-full"
            >
              {!rendering && <Film className="w-4 h-4" />}
              {rendering ? 'Rendering…' : 'Render Final Video'}
            </PrimaryButton>

            {rendering && (
              <div className="mt-4">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-rose-600 transition-all duration-200"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">{progressLabel}</p>
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="mt-3 w-full h-9 rounded-lg bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4">
                <ErrorNote message={error} />
              </div>
            )}
          </Card>

          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-relaxed">
              Rendering happens in this tab in real time, so keep it open and in the
              foreground. Output is <strong>WebM</strong> with video and audio.
            </p>
          </div>
        </div>
      </div>

      <LibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={importFromLibrary}
      />

      {showMusic && (
        <MusicPicker
          onClose={() => setShowMusic(false)}
          onPick={(track) => {
            if (musicUrl) URL.revokeObjectURL(musicUrl)

            // Used straight from the source rather than copied: these are
            // hotlinkable preview URLs, and re-hosting them is a separate
            // permission from using them.
            setMusicUrl(track.url)
            setMusicName(`${track.title}${track.artist ? ` — ${track.artist}` : ''}`)
            setMusicCredit(track.credit)
            setShowMusic(false)
          }}
        />
      )}
    </div>
  )
}
