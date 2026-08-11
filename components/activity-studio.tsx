'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Puzzle,
  Download,
  Shuffle,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  FileText,
  Shirt,
  Upload,
} from 'lucide-react'
import { AgentHeader, Card, Field, inputClass } from '@/components/agent-ui'
import { generateMaze, MAZE_SIZES } from '@/lib/activities/maze'
import { generateWordSearch, DIRECTION_SETS, type Difficulty } from '@/lib/activities/wordsearch'
import { dotToDot, SHAPES } from '@/lib/activities/dots'
import { PAPER_TYPES, TRIM_SIZES, RULE_SPACINGS } from '@/lib/activities/paper'
import { renderMaze, renderWordSearch, renderDotToDot, renderPaper } from '@/lib/activities/render'
import { MERCH_PRODUCTS, renderMerch } from '@/lib/mockup/merch'

/**
 * Activity and interior pages, made without a model.
 *
 * Every page here is drawn from code, which is not a shortcut — it is the
 * only way to get one that works. A maze from an image model has no route
 * through it and a word search does not contain its words; both look right
 * until somebody tries to solve them, which is after the book is printed.
 *
 * The practical effect is that these cost nothing and appear instantly, so a
 * customer can turn a twenty-page colouring book into a sixty-page activity
 * book without spending any of their monthly allowance.
 */

type Tab = 'maze' | 'wordsearch' | 'dots' | 'paper' | 'merch'

const TABS: { key: Tab; label: string; icon: typeof Puzzle }[] = [
  { key: 'maze', label: 'Mazes', icon: Puzzle },
  { key: 'wordsearch', label: 'Word search', icon: FileText },
  { key: 'dots', label: 'Dot to dot', icon: Plus },
  { key: 'paper', label: 'Journal pages', icon: FileText },
  { key: 'merch', label: 'Merch mockups', icon: Shirt },
]

export function ActivityStudio() {
  const [tab, setTab] = useState<Tab>('maze')
  const [trimKey, setTrimKey] = useState('8.5x11')
  const [preview, setPreview] = useState('')
  const [solution, setSolution] = useState('')
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState('')

  // Shared across tabs so switching between them does not reshuffle the page
  // the customer was just looking at.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))

  const [title, setTitle] = useState('')

  // Maze
  const [mazeSize, setMazeSize] = useState<string>('small')

  // Word search
  const [wordsText, setWordsText] = useState('cat\ndog\nrabbit\nelephant\ntiger\nmonkey')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')

  // Dot to dot
  const [shapeKey, setShapeKey] = useState('star')
  const [dotCount, setDotCount] = useState(24)

  // Paper
  const [paperKind, setPaperKind] = useState('lined')
  const [spacing, setSpacing] = useState('normal')

  // Merch
  const [product, setProduct] = useState('tshirt')
  const [artwork, setArtwork] = useState('')
  const [merchColour, setMerchColour] = useState('#1e293b')
  const artRef = useRef<HTMLInputElement>(null)

  const words = useMemo(
    () =>
      wordsText
        .split(/[\n,]/)
        .map((word) => word.trim())
        .filter(Boolean),
    [wordsText]
  )

  const puzzle = useMemo(
    () => (tab === 'wordsearch' ? generateWordSearch(words, { difficulty, seed }) : null),
    [tab, words, difficulty, seed]
  )

  /**
   * Redraw the preview.
   *
   * Canvas work is synchronous and fast, but merch has to decode an image
   * first, so everything is async and the whole thing is guarded — a throw
   * here would leave the page blank with no explanation.
   */
  const render = useCallback(async () => {
    setRendering(true)
    setError('')

    try {
      const page = { trimKey, title: title.trim() || undefined, pageCount: 100 }

      if (tab === 'maze') {
        const size = MAZE_SIZES.find((entry) => entry.key === mazeSize) ?? MAZE_SIZES[1]
        const maze = generateMaze(size.width, size.height, seed)

        setPreview(renderMaze(maze, page))
        setSolution(renderMaze(maze, { ...page, showSolution: true, title: 'Solution' }))
      } else if (tab === 'wordsearch') {
        if (!puzzle) return

        setPreview(renderWordSearch(puzzle, page))
        setSolution(renderWordSearch(puzzle, { ...page, showSolution: true, title: 'Solution' }))
      } else if (tab === 'dots') {
        const dots = dotToDot(shapeKey, { dots: dotCount, seed })

        setPreview(renderDotToDot(dots, page))
        setSolution(renderDotToDot(dots, { ...page, showSolution: true, title: 'Solution' }))
      } else if (tab === 'paper') {
        setPreview(renderPaper(paperKind, { ...page, spacing }))
        setSolution('')
      } else if (tab === 'merch') {
        setSolution('')

        if (!artwork) {
          setPreview('')
          return
        }

        setPreview(await renderMerch(product, { artwork, colour: merchColour }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draw that page')
      setPreview('')
    } finally {
      setRendering(false)
    }
  }, [
    tab,
    trimKey,
    title,
    seed,
    mazeSize,
    puzzle,
    shapeKey,
    dotCount,
    paperKind,
    spacing,
    product,
    artwork,
    merchColour,
  ])

  useEffect(() => {
    render()
  }, [render])

  const download = (dataUrl: string, name: string) => {
    const link = document.createElement('a')

    link.href = dataUrl
    link.download = `${name}.png`
    link.click()
  }

  const loadArtwork = (file: File) => {
    const reader = new FileReader()

    reader.onloadend = () => setArtwork(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<Puzzle className="w-5 h-5 text-white" />}
        gradient="from-teal-500 to-emerald-600"
        title="Activity Studio"
        subtitle="Mazes, puzzles, journal pages and product mockups — drawn instantly, no generations spent"
      />

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((entry) => {
          const Icon = entry.icon
          const active = entry.key === tab

          return (
            <button
              key={entry.key}
              onClick={() => setTab(entry.key)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                active
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white'
                  : 'ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {entry.label}
            </button>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-[20rem_1fr] gap-5 items-start">
        {/* Controls */}
        <Card>
          <div className="space-y-4">
            {tab !== 'merch' && (
              <>
                <Field label="Page title" hint="Printed at the top. Leave blank for none.">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Find your way home"
                    className={inputClass}
                  />
                </Field>

                <Field label="Book size" hint="Matches the trim sizes KDP sells.">
                  <select
                    value={trimKey}
                    onChange={(event) => setTrimKey(event.target.value)}
                    className={inputClass}
                  >
                    {TRIM_SIZES.map((size) => (
                      <option key={size.key} value={size.key}>
                        {size.label} — {size.note}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {tab === 'maze' && (
              <Field label="Difficulty">
                <select
                  value={mazeSize}
                  onChange={(event) => setMazeSize(event.target.value)}
                  className={inputClass}
                >
                  {MAZE_SIZES.map((size) => (
                    <option key={size.key} value={size.key}>
                      {size.label} · {size.width}×{size.height} · ages {size.ages}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {tab === 'wordsearch' && (
              <>
                <Field label="Words" hint="One per line, or separated by commas.">
                  <textarea
                    value={wordsText}
                    onChange={(event) => setWordsText(event.target.value)}
                    className={`${inputClass} h-32 resize-none py-2.5`}
                  />
                </Field>

                <Field label="Difficulty">
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                    className={inputClass}
                  >
                    {Object.keys(DIRECTION_SETS).map((key) => (
                      <option key={key} value={key}>
                        {key === 'easy'
                          ? 'Easy — across and down'
                          : key === 'medium'
                            ? 'Medium — adds diagonals'
                            : 'Hard — every direction, including backwards'}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Said here rather than discovered when a child cannot finish
                    the page. */}
                {puzzle && puzzle.rejected.length > 0 && (
                  <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-2.5 space-y-1">
                    {puzzle.rejected.map((entry) => (
                      <p key={entry.word} className="text-[11px] text-amber-800">
                        <span className="font-semibold">{entry.word}</span> — {entry.reason}
                      </p>
                    ))}
                  </div>
                )}

                {puzzle && puzzle.placed.length > 0 && (
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    {puzzle.placed.length} word{puzzle.placed.length === 1 ? '' : 's'} placed in a{' '}
                    {puzzle.size}×{puzzle.size} grid
                  </p>
                )}
              </>
            )}

            {tab === 'dots' && (
              <>
                <Field label="Shape">
                  <select
                    value={shapeKey}
                    onChange={(event) => setShapeKey(event.target.value)}
                    className={inputClass}
                  >
                    {SHAPES.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={`Dots — ${dotCount}`} hint="Fewer is easier for younger children.">
                  <input
                    type="range"
                    min={6}
                    max={60}
                    value={dotCount}
                    onChange={(event) => setDotCount(Number(event.target.value))}
                    className="w-full accent-teal-600"
                  />
                </Field>
              </>
            )}

            {tab === 'paper' && (
              <>
                <Field label="Page type">
                  <select
                    value={paperKind}
                    onChange={(event) => setPaperKind(event.target.value)}
                    className={inputClass}
                  >
                    {['Writing', 'Planning', 'Drawing'].map((group) => (
                      <optgroup key={group} label={group}>
                        {PAPER_TYPES.filter((entry) => entry.group === group).map((entry) => (
                          <option key={entry.key} value={entry.key}>
                            {entry.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>

                <p className="text-[11px] text-slate-400 -mt-2">
                  {PAPER_TYPES.find((entry) => entry.key === paperKind)?.description}
                </p>

                <Field label="Line spacing">
                  <select
                    value={spacing}
                    onChange={(event) => setSpacing(event.target.value)}
                    className={inputClass}
                  >
                    {RULE_SPACINGS.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {tab === 'merch' && (
              <>
                <Field label="Product">
                  <select
                    value={product}
                    onChange={(event) => {
                      setProduct(event.target.value)
                      setMerchColour(
                        MERCH_PRODUCTS.find((entry) => entry.key === event.target.value)?.colour ??
                          '#1e293b'
                      )
                    }}
                    className={inputClass}
                  >
                    {MERCH_PRODUCTS.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <p className="text-[11px] text-slate-400 -mt-2">
                  {MERCH_PRODUCTS.find((entry) => entry.key === product)?.hint}
                </p>

                <Field label="Colour">
                  <input
                    type="color"
                    value={merchColour}
                    onChange={(event) => setMerchColour(event.target.value)}
                    className="w-full h-10 rounded-xl ring-1 ring-slate-200 cursor-pointer"
                  />
                </Field>

                <div>
                  <button
                    onClick={() => artRef.current?.click()}
                    className="w-full h-10 rounded-xl ring-1 ring-slate-200 text-xs font-semibold text-slate-600 inline-flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {artwork ? 'Choose a different image' : 'Upload your artwork'}
                  </button>

                  <input
                    ref={artRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0]

                      if (file) loadArtwork(file)
                      event.target.value = ''
                    }}
                  />
                </div>
              </>
            )}

            {tab !== 'paper' && tab !== 'merch' && (
              <button
                onClick={() => setSeed(Math.floor(Math.random() * 1e9))}
                className="w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Shuffle className="w-4 h-4" />
                Make a different one
              </button>
            )}
          </div>
        </Card>

        {/* Preview */}
        <div className="space-y-3">
          {error && (
            <p className="p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-sm text-red-600">
              {error}
            </p>
          )}

          {tab === 'merch' && !artwork && (
            <div className="rounded-2xl ring-1 ring-slate-200 bg-white py-16 text-center">
              <Shirt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-900">Upload your artwork</p>
              <p className="text-sm text-slate-500 mt-1">
                A comic panel, a cover, or anything you have made.
              </p>
            </div>
          )}

          {preview && (
            <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-3">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full rounded-lg ring-1 ring-slate-100"
                />

                {rendering && (
                  <div className="absolute inset-0 grid place-items-center bg-white/60 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => download(preview, `${tab}-${seed}`)}
                  className="h-9 px-3 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download page
                </button>

                {solution && (
                  <button
                    onClick={() => download(solution, `${tab}-${seed}-solution`)}
                    className="h-9 px-3 rounded-lg ring-1 ring-slate-200 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download answer page
                  </button>
                )}
              </div>

              <p className="mt-2 text-[11px] text-slate-400 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                Drawn at 300 DPI with print margins already applied — ready to drop into a book.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
