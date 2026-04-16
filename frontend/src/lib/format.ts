/**
 * Formatting utilities for the crash game UI.
 * Money is always stored in integer cents — formatting is a presentation concern.
 */

/**
 * Format cents to a dollar string. E.g. 12500 → "$125.00"
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars)
}

/**
 * Format a multiplier value. E.g. 2.35 → "2.35x"
 */
export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`
}

/**
 * Parse a dollar input string to cents. E.g. "10.50" → 1050
 * Returns null if invalid.
 */
export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const parsed = parseFloat(trimmed)
  if (isNaN(parsed) || parsed < 0) return null

  // Round to avoid floating-point drift, then convert to cents
  return Math.round(parsed * 100)
}

/**
 * Format relative time. E.g. "2m ago"
 */
export function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

/**
 * Truncate a hash for display. E.g. "a3f8c1d9e7b2..." → "a3f8c1...b24d6e"
 */
export function truncateHash(hash: string, chars = 6): string {
  if (hash.length <= chars * 2) return hash
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`
}
