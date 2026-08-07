import { describe, it, expect } from 'vitest'
import {
  mergeLibraryLimits,
  quotaFor,
  decideOnSave,
  describeQuota,
  overBy,
  LIBRARY_KINDS,
  type OldestItem,
} from '@/lib/library/quota'

const oldest: OldestItem = {
  id: 'a1',
  title: 'The Night the Stars Went Quiet',
  createdAt: '2026-01-01T00:00:00Z',
  backedUp: false,
}

describe('the limit for someone holding several plans', () => {
  it('takes the larger number', () => {
    expect(mergeLibraryLimits([10, 50])).toBe(50)
  })

  it('lets unlimited beat any number', () => {
    // Front End caps at ten and OTO 1 removes the cap. Holding both must not
    // leave the customer capped.
    expect(mergeLibraryLimits([10, null])).toBeNull()
    expect(mergeLibraryLimits([null, 10])).toBeNull()
  })

  it('ignores plans that say nothing about the library', () => {
    expect(mergeLibraryLimits([10, undefined])).toBe(10)
  })

  it('treats an account with no plans as unlimited rather than zero', () => {
    // Zero would lock a superadmin out of their own library.
    expect(mergeLibraryLimits([])).toBeNull()
  })
})

describe('the quota', () => {
  it('counts what is left', () => {
    const quota = quotaFor(10, 4)

    expect(quota.remaining).toBe(6)
    expect(quota.full).toBe(false)
  })

  it('is full at the limit, not past it', () => {
    expect(quotaFor(10, 10).full).toBe(true)
    expect(quotaFor(10, 9).full).toBe(false)
  })

  it('stays full after a downgrade leaves someone over the limit', () => {
    // Holding 30 on a plan that now allows 10 is legitimate; it must not
    // report negative room.
    const quota = quotaFor(10, 30)

    expect(quota.full).toBe(true)
    expect(quota.remaining).toBe(0)
  })

  it('is never full when unlimited', () => {
    const quota = quotaFor(null, 9999)

    expect(quota.unlimited).toBe(true)
    expect(quota.full).toBe(false)
    expect(quota.remaining).toBeNull()
  })

  it('does not report a negative count', () => {
    expect(quotaFor(10, -5).used).toBe(0)
  })
})

describe('what happens when the customer saves', () => {
  it('just saves when there is room', () => {
    expect(decideOnSave({ quota: quotaFor(10, 3), oldest, driveConnected: false })).toEqual({
      action: 'save',
    })
  })

  it('asks when the library is full', () => {
    const choice = decideOnSave({ quota: quotaFor(10, 10), oldest, driveConnected: false })

    expect(choice.action).toBe('choose')
  })

  it('never decides to delete on its own', () => {
    // The one thing this flow must not do is silently drop work the customer
    // thought was kept.
    const choice = decideOnSave({ quota: quotaFor(10, 10), oldest, driveConnected: true })

    expect(choice.action).not.toBe('save')
    expect(JSON.stringify(choice)).not.toContain('delete')
  })

  it('still asks when the oldest is already backed up', () => {
    // Backed up makes replacing safe, not automatic — the customer chose to
    // keep it in the library too.
    const choice = decideOnSave({
      quota: quotaFor(10, 10),
      oldest: { ...oldest, backedUp: true },
      driveConnected: true,
    })

    expect(choice.action).toBe('choose')
    if (choice.action === 'choose') expect(choice.oldestIsSafe).toBe(true)
  })

  it('only offers a backup when Drive is actually connected', () => {
    const without = decideOnSave({ quota: quotaFor(10, 10), oldest, driveConnected: false })
    const with_ = decideOnSave({ quota: quotaFor(10, 10), oldest, driveConnected: true })

    if (without.action === 'choose') expect(without.canBackup).toBe(false)
    if (with_.action === 'choose') expect(with_.canBackup).toBe(true)
  })

  it('never asks an unlimited customer', () => {
    expect(decideOnSave({ quota: quotaFor(null, 500), oldest, driveConnected: false })).toEqual({
      action: 'save',
    })
  })

  it('copes with a full library that somehow has no oldest row', () => {
    const choice = decideOnSave({ quota: quotaFor(10, 10), oldest: null, driveConnected: false })

    expect(choice.action).toBe('choose')
    if (choice.action === 'choose') expect(choice.oldest).toBeNull()
  })
})

describe('how many have to go', () => {
  it('is none when there is room', () => {
    expect(overBy(quotaFor(10, 4))).toBe(0)
  })

  it('is one when exactly full', () => {
    expect(overBy(quotaFor(10, 10))).toBe(1)
  })

  it('counts the whole overhang after a downgrade', () => {
    expect(overBy(quotaFor(10, 13))).toBe(4)
  })

  it('accounts for saving several at once', () => {
    expect(overBy(quotaFor(10, 8), 5)).toBe(3)
  })

  it('is none when unlimited', () => {
    expect(overBy(quotaFor(null, 9999), 100)).toBe(0)
  })
})

describe('wording', () => {
  it('names the kind in the plural', () => {
    expect(describeQuota(quotaFor(10, 4), 'comic')).toBe('4 of 10 comics kept')
  })

  it('says unlimited rather than a made-up ceiling', () => {
    expect(describeQuota(quotaFor(null, 42), 'video')).toBe('42 videos kept · unlimited')
  })

  it('has a label for every kind the database allows', () => {
    // Matches the check constraint in migration 018.
    expect(LIBRARY_KINDS.map((entry) => entry.kind).sort()).toEqual([
      'coloring', 'comic', 'cover', 'episode', 'video',
    ])
  })
})

// ---------------------------------------------------------------------------
//  The save flow, pinned
// ---------------------------------------------------------------------------

import fs from 'node:fs'

describe('the cap is enforced where it counts', () => {
  const route = fs.readFileSync('app/api/library/route.ts', 'utf8')

  it('refuses a save that would exceed the limit, server-side', () => {
    // The dialog exists to let the customer choose what goes, not to be the
    // thing stopping them — a client-side check is advisory.
    expect(route).toMatch(/quota\.full && !replaceId/)
    expect(route).toContain('status: 409')
  })

  it('only removes an item the customer named', () => {
    // Nothing is deleted by inference. `replaceId` comes back from the dialog.
    expect(route).toContain('replaceId')
    expect(route).toMatch(/\.eq\('user_id', session\.userId\)/)
  })

  it('keeps the file when a requested backup fails', () => {
    // Losing the file is the one outcome this whole flow exists to prevent.
    expect(route).toMatch(/Could not back it up, so nothing was removed/)
  })

  it('checks the storage path belongs to the caller', () => {
    expect(route).toMatch(/path\.startsWith\(`\$\{session\.userId\}\/`\)/)
  })

  it('treats a repeat save of the same file as a no-op, not an error', () => {
    expect(route).toContain("error.code === '23505'")
  })
})

describe('every generator records what it made', () => {
  it('covers comics, colouring books and videos', () => {
    // Videos and covers previously existed only as objects in a bucket, so
    // they could not be listed, counted or backed up.
    for (const [file, kind] of [
      ['app/(shell)/comic/page.tsx', 'comic'],
      ['app/(shell)/coloring/page.tsx', 'coloring'],
      ['app/(shell)/video/page.tsx', 'video'],
    ] as const) {
      const source = fs.readFileSync(file, 'utf8')

      expect(source, `${file} does not save`).toContain('library.save')
      expect(source, `${file} wrong kind`).toContain(`kind: "${kind}"`)
      expect(source, `${file} never renders the dialog`).toContain('{library.dialog}')
    }
  })
})

describe('the full-library dialog', () => {
  const dialog = fs.readFileSync('components/library-full-dialog.tsx', 'utf8')

  it('escapes any transformed ancestor, like the share dialog', () => {
    expect(dialog).toContain('createPortal')
    expect(dialog).toMatch(/document\.body\s*\)/)
  })

  it('names the item that would go rather than just counting', () => {
    // "The oldest will be deleted" is a promise nobody can check.
    expect(dialog).toContain('oldest.title')
    expect(dialog).toContain('Oldest in your library')
  })

  it('offers a way out that loses nothing', () => {
    expect(dialog).toContain('Back up the oldest to Google Drive')
    expect(dialog).toContain('Download this one instead')
  })

  it('can always be dismissed', () => {
    expect(dialog).toContain("event.key === 'Escape'")
    expect(dialog).toContain('aria-label="Close"')
  })
})

describe('Google Drive', () => {
  const client = fs.readFileSync('lib/drive/client.ts', 'utf8')

  it('asks for the narrowest scope that can do the job', () => {
    // drive.file grants access only to files this app created — the
    // customer's own documents stay invisible to us.
    expect(client).toContain('auth/drive.file')
    expect(client).not.toContain('auth/drive.readonly')
    expect(client).not.toMatch(/auth\/drive['"]/)
  })

  it('asks for offline access, or a connection dies in an hour', () => {
    // Google only issues a refresh token with both of these, and only on the
    // first consent.
    expect(client).toContain("access_type: 'offline'")
    expect(client).toContain("prompt: 'consent'")
  })

  it('files uploads into one folder rather than loose in My Drive', () => {
    expect(client).toContain("name: 'ComicTale AI'")
    expect(client).toContain('folderId')
  })

  it('records the backup against the library row', () => {
    expect(client).toMatch(/drive_file_id: result\.fileId/)
  })
})
