import type { FieldCapabilities } from './types'

/** One decimal place (derived ratings are averages); an em dash for unrated. */
export function formatRating(value: number | null): string {
  return value === null ? '—' : (Math.round(value * 10) / 10).toString()
}

export type DotFill = 'full' | 'partial' | 'empty'

/** Five dots: full within a quarter of the dot's value, partial for anything above the previous one. */
export function dotFills(value: number | null): DotFill[] {
  return [1, 2, 3, 4, 5].map((i) => {
    if (value === null) return 'empty'
    if (value >= i - 0.25) return 'full'
    return value > i - 1 ? 'partial' : 'empty'
  })
}

/** Rollup shown with coverage, so one high rating on a barely-started specialisation doesn't read as mastery. */
export function rollupLabel(rating: number | null, rated: number, total: number, emptyLabel: string): string {
  if (total === 0) return emptyLabel
  return `${formatRating(rating)} avg · ${rated} of ${total} rated`
}

export const COVERAGE_HINT = 'Leaf topics rated by hand — everything above them is derived'

export function capabilityLabels(caps: FieldCapabilities): string[] {
  const out: string[] = []
  if (caps.allowsPrerequisites) out.push('prerequisites')
  if (caps.allowsSuggestedOrder) out.push('suggested order')
  if (caps.allowsLogs) out.push('logs')
  if (caps.allowsProjectLinks) out.push('project links')
  const depth = caps.maxNestingDepth
  out.push(depth === null ? 'nesting: unlimited' : depth === 0 ? 'nesting: flat' : `nesting: ${depth}`)
  return out
}
