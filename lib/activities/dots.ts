import { rng } from '@/lib/activities/maze'

/**
 * Dot-to-dot puzzles, traced from an outline.
 *
 * The outline can come from anywhere — one of the built-in shapes below, or
 * points traced from a colouring page. What this file does is turn a dense
 * outline into a numbered sequence a child can actually follow, which is a
 * different problem from having the outline.
 *
 * The hard part is spacing. An outline has hundreds of points and a dot-to-dot
 * wants thirty; taking every nth point puts them evenly along the *path*, so
 * a long straight edge gets a crowd of pointless dots and a tight curve gets
 * two and loses its shape. Simplifying by *significance* keeps the corners,
 * which are the only points that carry the drawing.
 */

export interface Point {
  x: number
  y: number
}

export interface DotToDot {
  /** Numbered in order, in 0-1 space so it prints at any size. */
  dots: Point[]
  closed: boolean
  seed: number
}

/**
 * Perpendicular distance from a point to the line through two others.
 *
 * The measure of how much a point matters: a point sitting on the line
 * between its neighbours adds nothing to the shape and can go.
 */
function deviation(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)

  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y)

  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length
}

/**
 * Keep only the points that carry the shape (Ramer-Douglas-Peucker).
 *
 * Iterative, not recursive: an outline traced from an image can be thousands
 * of points and the recursive form goes as deep as the data is long.
 */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points]

  const keep = new Array(points.length).fill(false)

  keep[0] = true
  keep[points.length - 1] = true

  const stack: [number, number][] = [[0, points.length - 1]]

  while (stack.length > 0) {
    const [first, last] = stack.pop()!

    let worst = 0
    let index = -1

    for (let i = first + 1; i < last; i++) {
      const distance = deviation(points[i], points[first], points[last])

      if (distance > worst) {
        worst = distance
        index = i
      }
    }

    if (index !== -1 && worst > tolerance) {
      keep[index] = true
      stack.push([first, index], [index, last])
    }
  }

  return points.filter((_, index) => keep[index])
}

/**
 * Reduce an outline to about `target` dots.
 *
 * Binary search on the tolerance rather than a fixed value, because the right
 * tolerance depends entirely on the shape: a circle and a star of the same
 * size need very different numbers to land on thirty dots.
 */
export function toDots(outline: Point[], target: number): Point[] {
  const wanted = Math.max(3, Math.min(200, Math.floor(target)))

  if (outline.length <= wanted) return [...outline]

  let low = 0
  let high = 1
  let best = simplify(outline, 0)

  for (let step = 0; step < 24; step++) {
    const mid = (low + high) / 2
    const simplified = simplify(outline, mid)

    if (simplified.length > wanted) {
      low = mid
      best = simplified
    } else {
      high = mid
      // A result at or just under the target is better than one far over it.
      if (simplified.length >= 3) best = simplified
    }

    if (simplified.length === wanted) return simplified
  }

  return best
}

// ---------------------------------------------------------------------------
//  Built-in outlines
// ---------------------------------------------------------------------------

/**
 * Shapes to trace, in 0-1 space.
 *
 * Deliberately simple and recognisable: the reward of a dot-to-dot is the
 * moment the shape appears, and that only lands if a child can name it.
 */
export const SHAPES: { key: string; label: string; build: () => Point[] }[] = [
  {
    key: 'star',
    label: 'Star',
    build: () => {
      const points: Point[] = []

      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
        const radius = i % 2 === 0 ? 0.46 : 0.19

        points.push({ x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius })
      }

      return points
    },
  },
  {
    key: 'heart',
    label: 'Heart',
    build: () => {
      const points: Point[] = []

      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2
        const x = 16 * Math.sin(t) ** 3
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)

        points.push({ x: 0.5 + x / 40, y: 0.5 - y / 40 })
      }

      return points
    },
  },
  {
    key: 'fish',
    label: 'Fish',
    build: () => {
      const points: Point[] = []

      for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * Math.PI * 2

        points.push({ x: 0.5 + 0.4 * Math.cos(t), y: 0.5 + 0.22 * Math.sin(t) })
      }

      // The tail, spliced into the body outline at the left.
      points.push({ x: 0.1, y: 0.5 }, { x: -0.02, y: 0.28 }, { x: -0.02, y: 0.72 }, { x: 0.1, y: 0.5 })

      return points
    },
  },
  {
    key: 'house',
    label: 'House',
    build: () => [
      { x: 0.5, y: 0.12 },
      { x: 0.88, y: 0.42 },
      { x: 0.8, y: 0.42 },
      { x: 0.8, y: 0.86 },
      { x: 0.2, y: 0.86 },
      { x: 0.2, y: 0.42 },
      { x: 0.12, y: 0.42 },
    ],
  },
  {
    key: 'boat',
    label: 'Boat',
    build: () => [
      { x: 0.5, y: 0.08 },
      { x: 0.5, y: 0.58 },
      { x: 0.86, y: 0.58 },
      { x: 0.76, y: 0.86 },
      { x: 0.24, y: 0.86 },
      { x: 0.14, y: 0.58 },
      { x: 0.5, y: 0.58 },
      { x: 0.5, y: 0.08 },
      { x: 0.82, y: 0.44 },
      { x: 0.5, y: 0.44 },
    ],
  },
]

export function shape(key: string) {
  return SHAPES.find((entry) => entry.key === key)
}

/** A numbered puzzle from one of the built-in shapes. */
export function dotToDot(
  shapeKey: string,
  options: { dots?: number; seed?: number } = {}
): DotToDot {
  const found = shape(shapeKey) ?? SHAPES[0]
  const outline = found.build()
  const seed = options.seed ?? Date.now()

  // Resampled to a smooth outline first, so simplifying has something to
  // choose from — a seven-point house cannot be reduced to twenty dots.
  const dense = resample(outline, 240, true)

  return { dots: toDots(dense, options.dots ?? 24), closed: true, seed }
}

/**
 * Walk a path at even spacing.
 *
 * Straight segments become a run of points so the simplifier has candidates
 * everywhere, rather than only where the original happened to have corners.
 */
export function resample(points: Point[], count: number, closed = false): Point[] {
  if (points.length < 2) return [...points]

  const path = closed ? [...points, points[0]] : points

  const lengths: number[] = []
  let total = 0

  for (let i = 1; i < path.length; i++) {
    const segment = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)

    lengths.push(segment)
    total += segment
  }

  if (total === 0) return [points[0]]

  const step = total / Math.max(1, count)
  const out: Point[] = [path[0]]

  let walked = 0
  let index = 0
  let along = 0

  for (let n = 1; n < count; n++) {
    const target = n * step

    while (index < lengths.length - 1 && walked + lengths[index] < target) {
      walked += lengths[index]
      index++
      along = 0
    }

    along = (target - walked) / (lengths[index] || 1)

    out.push({
      x: path[index].x + (path[index + 1].x - path[index].x) * along,
      y: path[index].y + (path[index + 1].y - path[index].y) * along,
    })
  }

  return out
}

/** Randomise which dot is number one, so the same shape reads differently. */
export function rotateStart(dots: Point[], seed: number): Point[] {
  if (dots.length < 3) return [...dots]

  const at = Math.floor(rng(seed)() * dots.length)

  return [...dots.slice(at), ...dots.slice(0, at)]
}
