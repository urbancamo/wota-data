/**
 * Shared utility functions used by both server and frontend code.
 * This file should not depend on DOM or Node-specific APIs.
 */

/**
 * Strip portable suffix (/P or /M) from a callsign
 */
export function stripPortableSuffix(callsign: string): string {
  return callsign.replace(/\/[PM]$/i, '')
}