import type { Dialogue } from '@/lib/comic/bubbles'

/**
 * Changing a comic after it has been generated.
 *
 * The gap this fills: everything was all-or-nothing. One bad panel out of
 * twenty-four meant regenerating the whole book — the customer's monthly
 * allowance spent again, five minutes gone, and twenty-three panels they were
 * happy with thrown away and redrawn differently. Editing a caption meant the
 * same. That is the single most expensive thing about the product.
 *
 * All of it is pure and immutable. The editor has undo, and undo is trivial
 * when every operation returns a new list and impossible when they mutate.
 */

export interface EditablePanel {
  id: string
  pageNumber: number
  panelNumber: number
  /** What is shown and exported: the drawing with its bubbles burned in. */
  image: string
  /**
   * The drawing before any bubble was painted on it.
   *
   * Kept because bubbles are composited into the pixels, so the displayed
   * image is not something you can composite onto twice — doing that draws
   * the new bubbles on top of the old ones and there is no way back. Every
   * re-render starts from here.
   *
   * Absent on panels made before the editor existed; callers fall back to
   * `image`, which is right for a panel that never had bubbles and merely
   * imperfect for one that did.
   */
  rawImage?: string
  /** What was asked for. Editable, because redrawing without changing it is
   *  just rolling the dice again. */
  prompt: string
  dialogues: Dialogue[]
  /** Set while a redraw is in flight, so the tile can show it. */
  status?: 'idle' | 'drawing' | 'failed'
  error?: string
}

// ---------------------------------------------------------------------------
//  Panels
// ---------------------------------------------------------------------------

/** Move a panel by `delta` places, clamped. Out-of-range moves are no-ops. */
export function movePanel<T>(panels: T[], index: number, delta: number): T[] {
  const target = index + delta

  if (index < 0 || index >= panels.length) return panels
  if (target < 0 || target >= panels.length) return panels

  const next = [...panels]
  const [moved] = next.splice(index, 1)

  next.splice(target, 0, moved)

  return next
}

export function removePanel<T>(panels: T[], index: number): T[] {
  if (index < 0 || index >= panels.length) return panels

  return panels.filter((_, at) => at !== index)
}

/**
 * Copy a panel and drop it in after the original.
 *
 * The copy gets a fresh id, because two panels sharing one would make every
 * subsequent edit apply to both — which looks like a haunting rather than a
 * bug when you hit it.
 */
export function duplicatePanel(
  panels: EditablePanel[],
  index: number,
  newId: () => string
): EditablePanel[] {
  const original = panels[index]

  if (!original) return panels

  const copy: EditablePanel = {
    ...original,
    id: newId(),
    // Deep enough: dialogues are edited in place by the bubble editor, so a
    // shared array would tie the copy's speech to the original's.
    dialogues: original.dialogues.map((dialogue) => ({ ...dialogue })),
  }

  const next = [...panels]

  next.splice(index + 1, 0, copy)

  return next
}

/**
 * Renumber pages and panels so they read 1..n after any rearrangement.
 *
 * Done as a separate step rather than inside each operation, so a sequence of
 * edits renumbers once at the end instead of shuffling numbers under the
 * customer's cursor while they are still moving things.
 */
export function renumber(panels: EditablePanel[], panelsPerPage: number): EditablePanel[] {
  const perPage = Math.max(1, Math.floor(panelsPerPage))

  return panels.map((panel, index) => ({
    ...panel,
    pageNumber: Math.floor(index / perPage) + 1,
    panelNumber: (index % perPage) + 1,
  }))
}

/** Panels grouped into pages, in order, for rendering and export. */
export function byPage(panels: EditablePanel[]): { pageNumber: number; panels: EditablePanel[] }[] {
  const pages = new Map<number, EditablePanel[]>()

  for (const panel of panels) {
    const list = pages.get(panel.pageNumber) ?? []

    list.push(panel)
    pages.set(panel.pageNumber, list)
  }

  return [...pages.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, list]) => ({
      pageNumber,
      panels: [...list].sort((a, b) => a.panelNumber - b.panelNumber),
    }))
}

/** Remove a whole page, keeping everything else in order. */
export function removePage(panels: EditablePanel[], pageNumber: number): EditablePanel[] {
  return panels.filter((panel) => panel.pageNumber !== pageNumber)
}

/**
 * Move a whole page up or down.
 *
 * Implemented by swapping page numbers rather than splicing, because a page
 * is a group of panels that must travel together and stay in their own order.
 */
export function movePage(
  panels: EditablePanel[],
  pageNumber: number,
  delta: number
): EditablePanel[] {
  const pages = byPage(panels).map((page) => page.pageNumber)
  const index = pages.indexOf(pageNumber)
  const target = index + delta

  if (index < 0 || target < 0 || target >= pages.length) return panels

  const reordered = movePanel(pages, index, delta)

  // Rebuild in the new page order, keeping each page's panels together.
  return reordered.flatMap((number) => panels.filter((panel) => panel.pageNumber === number))
}

// ---------------------------------------------------------------------------
//  Bubbles
// ---------------------------------------------------------------------------

/** The clean drawing to composite bubbles onto. */
export function sourceImage(panel: EditablePanel): string {
  return panel.rawImage || panel.image
}

/** Keep a bubble's anchor inside the panel, with a little breathing room. */
export function clampPosition(x: number, y: number, margin = 0.02): { x: number; y: number } {
  const limit = (value: number) => {
    if (!Number.isFinite(value)) return 0.5

    return Math.min(1 - margin, Math.max(margin, value))
  }

  return { x: limit(x), y: limit(y) }
}

export function addBubble(
  dialogues: Dialogue[],
  bubble: Partial<Dialogue> = {}
): Dialogue[] {
  // Placed left of centre and high, where a first bubble usually belongs and
  // where it is least likely to land on a face.
  const { x, y } = clampPosition(bubble.x ?? 0.08, bubble.y ?? 0.08)

  return [
    ...dialogues,
    {
      speaker: bubble.speaker ?? '',
      text: bubble.text ?? 'New line',
      type: bubble.type ?? 'speech',
      x,
      y,
    },
  ]
}

export function updateBubble(
  dialogues: Dialogue[],
  index: number,
  patch: Partial<Dialogue>
): Dialogue[] {
  if (index < 0 || index >= dialogues.length) return dialogues

  return dialogues.map((dialogue, at) => {
    if (at !== index) return dialogue

    const merged = { ...dialogue, ...patch }
    const { x, y } = clampPosition(merged.x, merged.y)

    return { ...merged, x, y }
  })
}

export function removeBubble(dialogues: Dialogue[], index: number): Dialogue[] {
  if (index < 0 || index >= dialogues.length) return dialogues

  return dialogues.filter((_, at) => at !== index)
}

// ---------------------------------------------------------------------------
//  Undo
// ---------------------------------------------------------------------------

export interface History<T> {
  past: T[]
  present: T
  future: T[]
}

/** How many steps back the customer can go. Enough to undo a bad idea. */
export const HISTORY_LIMIT = 30

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/**
 * Record a change.
 *
 * The redo stack is cleared, which is the standard rule and the right one:
 * having undone three steps and then done something new, the old future is no
 * longer reachable from here and offering it would redo something that never
 * happened.
 */
export function commit<T>(history: History<T>, next: T): History<T> {
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  }
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history

  const previous = history.past[history.past.length - 1]

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history

  const [next, ...rest] = history.future

  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
  }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}
