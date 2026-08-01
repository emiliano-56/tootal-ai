/**
 * Composes a finished video in the browser from a mixed timeline of
 * comic stills and AI-generated video clips.
 *
 * Stills get a cinematic camera move; clips are played through and drawn onto
 * the same canvas, so the result is one continuous video rather than a slideshow.
 * Audio from the clips (plus optional background music) is mixed through a
 * WebAudio graph and recorded alongside the canvas.
 */

export type CameraMove =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'

export type ShotKind = 'image' | 'video'

export interface Shot {
  kind: ShotKind
  /** data: URL for stills, object URL (same-origin) for clips. */
  src: string
  caption?: string
  /** Stills only. */
  move?: CameraMove
  /** Stills only — clips play for their natural length. */
  duration?: number
}

export interface RenderOptions {
  width: number
  height: number
  fps?: number
  /** Cross-fade length in seconds, used between stills. */
  transition?: number
  /** Optional background music, mixed under everything. */
  musicSrc?: string
  musicVolume?: number
  onProgress?: (fraction: number, label: string) => void
  signal?: AbortSignal
}

export const ASPECTS = {
  landscape: { width: 1920, height: 1080, label: 'Landscape 16:9', ratio: '16:9' },
  vertical: { width: 1080, height: 1920, label: 'Vertical 9:16', ratio: '9:16' },
  square: { width: 1080, height: 1080, label: 'Square 1:1', ratio: '1:1' },
} as const

export type AspectKey = keyof typeof ASPECTS

const MOVES: CameraMove[] = [
  'zoom-in',
  'pan-right',
  'zoom-out',
  'pan-left',
  'pan-up',
  'pan-down',
]

export function autoMove(index: number): CameraMove {
  return MOVES[index % MOVES.length]
}

export function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  )
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load an image'))
    img.src = src
  })
}

/** Loads a clip far enough that duration and dimensions are known. */
function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = false
    video.playsInline = true
    video.src = src

    const done = () => resolve(video)
    video.onloadeddata = done
    video.oncanplaythrough = done
    video.onerror = () => reject(new Error('Could not load a video clip'))

    // Some browsers stall on canplaythrough for local blobs.
    setTimeout(() => {
      if (video.readyState >= 2) resolve(video)
    }, 4000)
  })
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Cover-fit draw with an optional camera move applied at progress `t`. */
function drawStill(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  move: CameraMove,
  t: number,
  W: number,
  H: number,
  alpha: number
) {
  const e = easeInOut(Math.min(Math.max(t, 0), 1))
  const base = Math.max(W / img.width, H / img.height)

  let scale = base * 1.18
  let offsetX = 0
  let offsetY = 0

  const maxDX = (img.width * scale - W) / 2
  const maxDY = (img.height * scale - H) / 2

  switch (move) {
    case 'zoom-in':
      scale = base * (1.02 + 0.22 * e)
      break
    case 'zoom-out':
      scale = base * (1.24 - 0.22 * e)
      break
    case 'pan-left':
      offsetX = maxDX * (1 - 2 * e)
      break
    case 'pan-right':
      offsetX = -maxDX * (1 - 2 * e)
      break
    case 'pan-up':
      offsetY = maxDY * (1 - 2 * e)
      break
    case 'pan-down':
      offsetY = -maxDY * (1 - 2 * e)
      break
  }

  const dw = img.width * scale
  const dh = img.height * scale

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(img, (W - dw) / 2 + offsetX, (H - dh) / 2 + offsetY, dw, dh)
  ctx.restore()
}

/** Cover-fit draw of the current video frame. */
function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  W: number,
  H: number
) {
  const vw = video.videoWidth || W
  const vh = video.videoHeight || H
  const scale = Math.max(W / vw, H / vh)
  const dw = vw * scale
  const dh = vh * scale
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh)
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, W: number, H: number) {
  const fontSize = Math.round(W * 0.032)
  ctx.save()
  ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const maxWidth = W * 0.82
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)

  const lineHeight = fontSize * 1.3
  const blockH = lines.length * lineHeight
  const bottomPad = H * 0.08
  const startY = H - bottomPad - blockH + lineHeight / 2

  const grad = ctx.createLinearGradient(0, H - bottomPad - blockH - fontSize * 1.5, 0, H)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.75)')
  ctx.fillStyle = grad
  ctx.fillRect(0, H - bottomPad - blockH - fontSize * 1.5, W, bottomPad + blockH + fontSize * 1.5)

  lines.forEach((l, i) => {
    const y = startY + i * lineHeight
    ctx.lineWidth = fontSize * 0.16
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.strokeText(l, W / 2, y)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(l, W / 2, y)
  })

  ctx.restore()
}

function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return 'video/webm'
}

/** Total runtime of the timeline, used for progress and the duration readout. */
export function estimateDuration(shots: Shot[], clipDurations: Record<number, number>) {
  return shots.reduce((sum, shot, i) => {
    if (shot.kind === 'video') return sum + (clipDurations[i] ?? 8)
    return sum + (shot.duration ?? 4)
  }, 0)
}

export async function renderVideo(shots: Shot[], options: RenderOptions): Promise<Blob> {
  if (!isSupported()) {
    throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox.')
  }
  if (shots.length === 0) {
    throw new Error('Add at least one page or clip.')
  }

  const {
    width: W,
    height: H,
    fps = 30,
    transition = 0.6,
    musicSrc,
    musicVolume = 0.25,
    onProgress,
    signal,
  } = options

  onProgress?.(0, 'Loading media…')

  // --- Preload every shot -------------------------------------------------
  const images: (HTMLImageElement | null)[] = []
  const videos: (HTMLVideoElement | null)[] = []

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]
    onProgress?.(0, `Loading ${i + 1} of ${shots.length}…`)

    if (shot.kind === 'video') {
      videos[i] = await loadVideo(shot.src)
      images[i] = null
    } else {
      images[i] = await loadImage(shot.src)
      videos[i] = null
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')

  // --- Audio graph --------------------------------------------------------
  // Clip audio and background music are mixed into one destination stream so
  // the recording carries sound, not just pictures.
  let audioCtx: AudioContext | null = null
  let audioDest: MediaStreamAudioDestinationNode | null = null
  let musicEl: HTMLAudioElement | null = null

  const hasClips = videos.some(Boolean)

  if (hasClips || musicSrc) {
    try {
      audioCtx = new AudioContext()
      audioDest = audioCtx.createMediaStreamDestination()

      for (const video of videos) {
        if (!video) continue
        const source = audioCtx.createMediaElementSource(video)
        source.connect(audioDest)
      }

      if (musicSrc) {
        musicEl = new Audio(musicSrc)
        musicEl.loop = true
        musicEl.crossOrigin = 'anonymous'
        const musicSource = audioCtx.createMediaElementSource(musicEl)
        const gain = audioCtx.createGain()
        gain.gain.value = musicVolume
        musicSource.connect(gain).connect(audioDest)
      }
    } catch (err) {
      // Audio is a bonus; never fail the whole render because of it.
      console.warn('[composer] audio graph unavailable:', err)
      audioCtx = null
      audioDest = null
      musicEl = null
    }
  }

  const canvasStream = canvas.captureStream(fps)
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]
  if (audioDest) tracks.push(...audioDest.stream.getAudioTracks())

  const recorder = new MediaRecorder(new MediaStream(tracks), {
    mimeType: pickMimeType(),
    videoBitsPerSecond: 6_000_000,
  })

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
    recorder.onerror = () => reject(new Error('Recording failed.'))
  })

  // Total runtime for progress reporting.
  const totalSeconds = shots.reduce((sum, shot, i) => {
    const v = videos[i]
    if (shot.kind === 'video' && v) return sum + (isFinite(v.duration) ? v.duration : 8)
    return sum + (shot.duration ?? 4)
  }, 0)

  let elapsed = 0
  const frameMs = 1000 / fps

  recorder.start()
  await audioCtx?.resume().catch(() => {})
  musicEl?.play().catch(() => {})

  try {
    for (let i = 0; i < shots.length; i++) {
      if (signal?.aborted) throw new Error('Cancelled')

      const shot = shots[i]
      const caption = shot.caption?.trim()

      if (shot.kind === 'video' && videos[i]) {
        // ---- AI clip: play it through, drawing each frame ----
        const video = videos[i]!
        video.currentTime = 0
        await video.play().catch(() => {})

        const clipLength = isFinite(video.duration) && video.duration > 0 ? video.duration : 8
        const started = performance.now()

        while (!video.ended && (performance.now() - started) / 1000 < clipLength + 0.3) {
          if (signal?.aborted) {
            video.pause()
            throw new Error('Cancelled')
          }

          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, W, H)
          drawVideoFrame(ctx, video, W, H)
          if (caption) drawCaption(ctx, caption, W, H)

          const secs = (performance.now() - started) / 1000
          onProgress?.(
            Math.min((elapsed + secs) / totalSeconds, 0.99),
            `Clip ${i + 1} of ${shots.length} — ${secs.toFixed(1)}s`
          )

          await new Promise((r) => setTimeout(r, frameMs))
        }

        video.pause()
        elapsed += clipLength
      } else if (images[i]) {
        // ---- Still: camera move + cross-fade into the next shot ----
        const img = images[i]!
        const move = shot.move ?? autoMove(i)
        const duration = shot.duration ?? 4
        const frames = Math.round(duration * fps)
        const transitionFrames = Math.round(transition * fps)

        for (let f = 0; f < frames; f++) {
          if (signal?.aborted) throw new Error('Cancelled')

          const t = f / Math.max(frames - 1, 1)

          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, W, H)
          drawStill(ctx, img, move, t, W, H, 1)

          // Only cross-fade into another still; clips cut in cleanly.
          const intoNext = f - (frames - transitionFrames)
          const nextImg = images[i + 1]
          if (nextImg && intoNext > 0) {
            drawStill(
              ctx,
              nextImg,
              shots[i + 1].move ?? autoMove(i + 1),
              0,
              W,
              H,
              intoNext / transitionFrames
            )
          }

          if (caption) drawCaption(ctx, caption, W, H)

          if (f % 5 === 0) {
            onProgress?.(
              Math.min((elapsed + f / fps) / totalSeconds, 0.99),
              `Page ${i + 1} of ${shots.length}`
            )
          }

          await new Promise((r) => setTimeout(r, frameMs))
        }

        elapsed += duration
      }
    }
  } finally {
    musicEl?.pause()
    recorder.stop()
    // Give the recorder a moment to flush the final chunk.
    await new Promise((r) => setTimeout(r, 300))
    audioCtx?.close().catch(() => {})
  }

  onProgress?.(1, 'Finalising video…')
  return finished
}
