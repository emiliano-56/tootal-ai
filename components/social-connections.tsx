'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  Link2,
  Loader2,
  Plug,
  Send,
  Settings2,
  Trash2,
  X,
  HardDrive,
} from 'lucide-react'
import { NETWORKS, POSTABLE, network } from '@/lib/social/networks'

/**
 * Connecting the accounts Autopilot posts to.
 *
 * The screen is deliberately blunt about what each platform costs to set up.
 * Telegram works the moment you paste a bot token; Facebook and Instagram need
 * an app Meta has reviewed. A customer who learns that after connecting has
 * been misled, so it is on the card before they click.
 */

interface Connection {
  id: string
  platform: string
  account_id: string | null
  account_name: string
  status: string
  settings: Record<string, unknown>
  last_error: string | null
  last_posted_at: string | null
}

export function SocialConnections({ compact }: { compact?: boolean }) {
  const params = useSearchParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [available, setAvailable] = useState<string[]>([])
  const [drive, setDrive] = useState<{
    id: string
    accountName: string
    status: string
    autoSync: boolean
    lastSyncedAt: string | null
  } | null>(null)
  const [driveAvailable, setDriveAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [telegram, setTelegram] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch('/api/social')
    const payload = await response.json().catch(() => ({}))

    if (response.ok) {
      setConnections(payload.connections ?? [])
      setAvailable(payload.available ?? [])
      setDrive(payload.drive ?? null)
      setDriveAvailable(Boolean(payload.driveAvailable))
    } else {
      setError(payload.error ?? 'Could not load your connections')
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // The OAuth callback redirects back here with its result in the query.
  useEffect(() => {
    const connected = params.get('connected')
    const failed = params.get('error')

    if (connected) setNotice(connected)
    if (failed) setError(failed)
  }, [params])

  const call = async (payload: Record<string, unknown>, label: string, done?: string) => {
    setBusy(label)
    setError('')
    setNotice('')

    const response = await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok || result.error) setError(result.error ?? 'Something went wrong')
    else {
      if (done) setNotice(done)
      await load()
    }

    setBusy('')
    return { ok: response.ok && !result.error, result }
  }

  const connect = async (platform: string) => {
    if (platform === 'telegram') {
      setTelegram(true)
      return
    }

    const { ok, result } = await call({ action: 'authorize', platform }, platform)

    // A full navigation, not a popup: several platforms refuse to render their
    // consent screen inside one.
    if (ok && result.url) window.location.href = result.url
  }

  const byPlatform = new Map(connections.map((entry) => [entry.platform, entry]))

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {!compact && (
        <div className="mb-6">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Connected accounts
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Autopilot posts to whichever of these you attach to a campaign.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 ring-1 ring-red-100 dark:ring-red-500/20 text-sm text-red-600">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-100 dark:ring-emerald-500/20 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </div>
      )}

      {/* Backup, not publishing — so it sits on its own above the networks. */}
      <div className="mb-5 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 w-10 h-10 rounded-xl grid place-items-center bg-[#1a73e8] text-white">
              <HardDrive className="w-5 h-5" />
            </span>

            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                Google Drive
                {drive?.status === 'active' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {drive
                  ? drive.accountName
                  : 'Back your library up to your own Drive, so nothing is lost when it fills up.'}
              </p>
            </div>
          </div>

          {drive ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="relative inline-flex">
                  <input
                    type="checkbox"
                    checked={drive.autoSync}
                    onChange={(event) =>
                      call(
                        { action: 'auto_sync', enabled: event.target.checked },
                        'auto-sync',
                        event.target.checked ? 'Auto-sync on.' : 'Auto-sync off.'
                      )
                    }
                    className="peer sr-only"
                  />
                  <span className="w-11 h-6 rounded-full bg-slate-200 dark:bg-slate-700 peer-checked:bg-emerald-500 transition-colors" />
                  <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Auto-sync
                </span>
              </label>

              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'Disconnect Google Drive? Files already uploaded stay in your Drive.'
                    )
                  ) {
                    call({ action: 'disconnect', id: drive.id }, 'drive-off', 'Drive disconnected.')
                  }
                }}
                aria-label="Disconnect Google Drive"
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                const { ok, result } = await call({ action: 'authorize_drive' }, 'drive')

                if (ok && result.url) window.location.href = result.url
              }}
              disabled={busy === 'drive' || !driveAvailable}
              title={driveAvailable ? undefined : 'The platform owner has not set Drive up yet'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-40"
            >
              {busy === 'drive' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plug className="w-3 h-3" />
              )}
              {driveAvailable ? 'Connect' : 'Not set up'}
            </button>
          )}
        </div>

        {drive?.autoSync && (
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            Every new comic, colouring book and video is copied to your Drive as it is made — so
            when your library fills up, replacing the oldest loses nothing.
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {POSTABLE.map((entry) => {
          const connection = byPlatform.get(entry.id)
          const ready = available.includes(entry.id)

          return (
            <div
              key={entry.id}
              className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className="shrink-0 w-10 h-10 rounded-xl grid place-items-center text-white font-bold"
                  style={{ backgroundColor: entry.colour }}
                >
                  {entry.label.charAt(0)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    {entry.label}

                    {connection && connection.status === 'active' && (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    )}

                    {connection?.status === 'expired' && (
                      <span className="text-[10px] font-bold text-amber-600 uppercase">
                        reconnect
                      </span>
                    )}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {connection ? connection.account_name : entry.note ?? 'Not connected'}
                  </p>

                  {connection?.last_error && (
                    <p className="mt-1 text-[11px] text-red-500 line-clamp-2">
                      {connection.last_error}
                    </p>
                  )}

                  {!connection && entry.needsReview && (
                    <p className="mt-1 text-[11px] text-amber-600 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                      Needs an app this platform has reviewed
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {connection ? (
                  <>
                    <button
                      onClick={() =>
                        call({ action: 'test', id: connection.id }, `test-${connection.id}`, 'Test post sent.')
                      }
                      disabled={busy === `test-${connection.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      {busy === `test-${connection.id}` ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      Test post
                    </button>

                    {entry.id === 'reddit' && (
                      <button
                        onClick={() => {
                          const value = window.prompt(
                            'Which subreddit should posts go to?\n(without the r/)',
                            String(connection.settings.subreddit ?? '')
                          )

                          if (value !== null) {
                            call(
                              { action: 'settings', id: connection.id, subreddit: value },
                              `set-${connection.id}`,
                              'Subreddit saved.'
                            )
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Settings2 className="w-3 h-3" />
                        {connection.settings.subreddit ? `r/${connection.settings.subreddit}` : 'Pick subreddit'}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (window.confirm(`Disconnect ${entry.label}?`)) {
                          call(
                            { action: 'disconnect', id: connection.id },
                            `off-${connection.id}`,
                            `${entry.label} disconnected.`
                          )
                        }
                      }}
                      aria-label={`Disconnect ${entry.label}`}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => connect(entry.id)}
                    disabled={busy === entry.id || (!ready && entry.connect === 'oauth')}
                    title={
                      !ready && entry.connect === 'oauth'
                        ? 'The platform owner has not set this one up yet'
                        : undefined
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-40"
                  >
                    {busy === entry.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plug className="w-3 h-3" />
                    )}
                    {!ready && entry.connect === 'oauth' ? 'Not set up' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* The two that can never be automated, said once and plainly. */}
      <div className="mt-6 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          Share only
        </p>

        <div className="space-y-1.5">
          {NETWORKS.filter((entry) => !entry.canAutoPost).map((entry) => (
            <p key={entry.id} className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{entry.label}</span>
              {' — '}
              {entry.note}
            </p>
          ))}
        </div>
      </div>

      {telegram && (
        <TelegramDialog
          busy={busy === 'telegram-connect'}
          onClose={() => setTelegram(false)}
          onSave={async (botToken, chatId) => {
            const { ok } = await call(
              { action: 'connect_telegram', botToken, chatId },
              'telegram-connect',
              'Telegram connected.'
            )

            if (ok) setTelegram(false)
          }}
        />
      )}
    </div>
  )
}

function TelegramDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (botToken: string, chatId: string) => void
}) {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')

  const info = network('telegram')

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md my-8 bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Connect Telegram
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{info?.note}</p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
            <li>
              Message <strong>@BotFather</strong> on Telegram and send{' '}
              <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">/newbot</code>.
            </li>
            <li>Copy the token it gives you into the first box below.</li>
            <li>Add the bot to your channel or group as an administrator.</li>
            <li>
              Put the channel&rsquo;s <strong>@username</strong> in the second box (or its numeric
              id for a private one).
            </li>
          </ol>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
              Bot token
            </label>
            <input
              value={botToken}
              onChange={(event) => setBotToken(event.target.value)}
              placeholder="123456:ABC-DEF…"
              className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
              Channel
            </label>
            <input
              value={chatId}
              onChange={(event) => setChatId(event.target.value)}
              placeholder="@mychannel"
              className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>

          <button
            onClick={() => onSave(botToken, chatId)}
            disabled={busy || !botToken.trim() || !chatId.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}
