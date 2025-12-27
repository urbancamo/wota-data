/**
 * Format WOTA reference from wotaid number
 *
 * Rules:
 * - wotaid <= 214: LDW-XXX (Wainwright)
 * - wotaid > 214: LDO-XXX (Outlying Fell, subtract 214)
 *
 * @param wotaid The WOTA ID number
 * @returns Formatted reference (e.g., "LDW-001", "LDO-042")
 */
export function formatWotaReference(wotaid: number | null | undefined): string {
  if (wotaid === null || wotaid === undefined) {
    return 'N/A'
  }

  if (wotaid <= 214) {
    // LDW reference - use wotaid directly
    const paddedNumber = String(wotaid).padStart(3, '0')
    return `LDW-${paddedNumber}`
  } else {
    // LDO reference - subtract 214 from wotaid
    const ldoNumber = wotaid - 214
    const paddedNumber = String(ldoNumber).padStart(3, '0')
    return `LDO-${paddedNumber}`
  }
}

/**
 * Parse a WOTA reference string back to wotaid number
 *
 * @param reference The formatted reference (e.g., "LDW-001", "LDO-042")
 * @returns The wotaid number, or null if invalid
 */
export function parseWotaReference(reference: string): number | null {
  const ldwMatch = reference.match(/^LDW-(\d+)$/i)
  if (ldwMatch) {
    return parseInt(ldwMatch[1], 10)
  }

  const ldoMatch = reference.match(/^LDO-(\d+)$/i)
  if (ldoMatch) {
    const ldoNumber = parseInt(ldoMatch[1], 10)
    return ldoNumber + 214
  }

  return null
}
