import type { EditablePanel } from '@/lib/comic/editor'

/**
 * Saving a comic so you can go back to it.
 *
 * The panel editor has undo and undo dies with the tab. Redraw a page, close
 * the laptop, and yesterday's version is gone — which makes editing something
 * you do carefully rather than freely, and the whole point of the editor was
 * to make it cheap to try things.
 *
 * What a snapshot deliberately does NOT contain is the panel images. They are
 * data URLs of about a megabyte each; twenty-four of them is a 24MB row, per
 * save. Storing them would be slow to write, slow to read, and would fill the
 * database inside a week.
 *
 * So a snapshot holds what is needed to *rebuild*: the prompt, the bubbles,
 * the order, the layout. Restoring brings all of that back and leaves the
 * pictures to be redrawn — which costs generations, so the restore says so
 * rather than quietly presenting an empty comic.
 */

export interface Snapshot {
  version: 1
  title: string
  format: string
  artStyle: string
  panelsPerPage: number
  layouts: Record<number, string>
  castIds: string[]
  panels: {
    id: string
    pageNumber: number
    panelNumber: number
    prompt: string
    dialogues: EditablePanel['dialogues']
  }[]
}

/** Everything except the pixels. */
export function toSnapshot(input: {
  title?: string
  format?: string
  artStyle?: string
  panelsPerPage?: number
  layouts?: Record<number, string>
  castIds?: string[]
  panels: EditablePanel[]
}): Snapshot {
  return {
    version: 1,
    title: input.title ?? '',
    format: input.format ?? 'comic',
    artStyle: input.artStyle ?? '',
    panelsPerPage: input.panelsPerPage ?? 4,
    layouts: input.layouts ?? {},
    castIds: input.castIds ?? [],
    panels: input.panels.map((panel) => ({
      id: panel.id,
      pageNumber: panel.pageNumber,
      panelNumber: panel.panelNumber,
      prompt: panel.prompt,
      dialogues: panel.dialogues.map((dialogue) => ({ ...dialogue })),
    })),
  }
}

export interface Restored {
  snapshot: Snapshot
  panels: EditablePanel[]
  /** How many panels come back with no picture and will need redrawing. */
  needsRedraw: number
}

/**
 * Turn a snapshot back into something editable.
 *
 * Images from the current panels are carried across where the ids still
 * match, so restoring after a text edit does not throw away artwork that is
 * still correct. That is the common case by far — most restores are undoing a
 * caption or a reorder, not a redraw.
 */
export function fromSnapshot(snapshot: Snapshot, current: EditablePanel[] = []): Restored {
  const byId = new Map(current.map((panel) => [panel.id, panel]))

  const panels: EditablePanel[] = snapshot.panels.map((panel) => {
    const existing = byId.get(panel.id)

    return {
      id: panel.id,
      pageNumber: panel.pageNumber,
      panelNumber: panel.panelNumber,
      prompt: panel.prompt,
      dialogues: panel.dialogues.map((dialogue) => ({ ...dialogue })),
      image: existing?.image ?? '',
      rawImage: existing?.rawImage,
    }
  })

  return {
    snapshot,
    panels,
    needsRedraw: panels.filter((panel) => !panel.image).length,
  }
}

/**
 * Whether a snapshot is worth saving.
 *
 * Saving one identical to the last leaves a history of indistinguishable
 * entries that makes finding the version you wanted harder, not easier.
 * Compared on the rebuildable state only — an image being redrawn is a change
 * worth keeping, but it is not visible here, so the caller says so.
 */
export function isDifferent(a: Snapshot | null, b: Snapshot): boolean {
  if (!a) return true

  return JSON.stringify(stripVolatile(a)) !== JSON.stringify(stripVolatile(b))
}

function stripVolatile(snapshot: Snapshot) {
  return {
    ...snapshot,
    panels: snapshot.panels.map(({ id, ...rest }) => rest),
  }
}

/** A label from what changed, so history reads as a story rather than timestamps. */
export function describeChange(previous: Snapshot | null, next: Snapshot): string {
  if (!previous) return 'First version'

  if (previous.panels.length !== next.panels.length) {
    const delta = next.panels.length - previous.panels.length

    return delta > 0
      ? `Added ${delta} panel${delta === 1 ? '' : 's'}`
      : `Removed ${-delta} panel${-delta === 1 ? '' : 's'}`
  }

  // Reorder is checked first, and it has to be: once the ids have moved,
  // comparing panel[0] to panel[0] compares two different panels, and every
  // swap would be reported as a rewording of everything that moved.
  const reordered = next.panels.some((panel, index) => panel.id !== previous.panels[index]?.id)

  if (reordered) return 'Reordered panels'

  const before = new Map(previous.panels.map((panel) => [panel.id, panel]))

  const promptsChanged = next.panels.filter(
    (panel) => panel.prompt !== before.get(panel.id)?.prompt
  ).length

  if (promptsChanged > 0) {
    return `Reworded ${promptsChanged} panel${promptsChanged === 1 ? '' : 's'}`
  }

  const bubblesChanged = next.panels.filter(
    (panel) => JSON.stringify(panel.dialogues) !== JSON.stringify(before.get(panel.id)?.dialogues)
  ).length

  if (bubblesChanged > 0) {
    return `Edited speech on ${bubblesChanged} panel${bubblesChanged === 1 ? '' : 's'}`
  }

  if (JSON.stringify(next.layouts) !== JSON.stringify(previous.layouts)) return 'Changed layout'

  return 'Small changes'
}

/**
 * How many versions to keep.
 *
 * Enough to cover a working session. Beyond that the list stops being
 * browsable and starts being an archive nobody reads, and each row is a
 * database write the customer never asked for.
 */
export const VERSION_LIMIT = 25
