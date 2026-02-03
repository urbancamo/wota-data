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
    return parseInt(ldwMatch[1]!, 10)
  }

  const ldoMatch = reference.match(/^LDO-(\d+)$/i)
  if (ldoMatch) {
    const ldoNumber = parseInt(ldoMatch[1]!, 10)
    return ldoNumber + 214
  }

  return null
}

/**
 * Format SOTA reference from sotaid number
 *
 * @param sotaid The SOTA ID number
 * @returns Formatted reference (e.g., "G/LD-001")
 */
export function formatSotaReference(sotaid: number | null | undefined): string {
  if (sotaid === null || sotaid === undefined) {
    return '-'
  }

  const paddedNumber = String(sotaid).padStart(3, '0')
  return `G/LD-${paddedNumber}`
}

/**
 * Format Hump reference from humpid number
 *
 * @param humpid The Hump ID number
 * @returns Formatted reference (e.g., "G/HLD-001")
 */
export function formatHumpReference(humpid: number | null | undefined): string {
  if (humpid === null || humpid === undefined) {
    return '-'
  }

  const paddedNumber = String(humpid).padStart(3, '0')
  return `G/HLD-${paddedNumber}`
}

/**
 * Format book code to full book name
 *
 * @param bookCode The book code (e.g., "E", "FE", "C")
 * @returns Full book name (e.g., "The Eastern Fells")
 */
export function formatBookName(bookCode: string | null | undefined): string {
  if (!bookCode) {
    return '-'
  }

  const bookNames: Record<string, string> = {
    'E': 'Eastern Fells',
    'FE': 'Far Eastern Fells',
    'C': 'Central Fells',
    'S': 'Southern Fells',
    'N': 'Northern Fells',
    'NW': 'North Western Fells',
    'W': 'Western Fells',
    'OF': 'Outlying Fells'
  }

  return bookNames[bookCode.toUpperCase()] || bookCode
}

/**
 * Convert OS Grid Reference to Lat/Lng (WGS84)
 *
 * @param gridRef OS Grid Reference (e.g., "NY273209" or "NY 273 209")
 * @returns { lat, lng } or null if invalid
 */
export function gridRefToLatLng(gridRef: string | null | undefined): { lat: number; lng: number } | null {
  if (!gridRef) return null

  // Remove spaces and convert to uppercase
  const ref = gridRef.replace(/\s/g, '').toUpperCase()

  // Match pattern: 2 letters followed by even number of digits (4, 6, 8, or 10)
  const match = ref.match(/^([A-Z]{2})(\d+)$/)
  if (!match || !match[1] || !match[2]) return null

  const letters = match[1]
  const digits = match[2]

  // Must have even number of digits
  if (digits.length % 2 !== 0 || digits.length < 4) return null

  // Grid square letter to 100km square origin
  // First letter: 500km squares (S, T for southern Britain; N, O for northern)
  // Second letter: 100km squares within
  const gridSquares: Record<string, { e: number; n: number }> = {
    'SV': { e: 0, n: 0 }, 'SW': { e: 100000, n: 0 }, 'SX': { e: 200000, n: 0 }, 'SY': { e: 300000, n: 0 }, 'SZ': { e: 400000, n: 0 },
    'SR': { e: 100000, n: 100000 }, 'SS': { e: 200000, n: 100000 }, 'ST': { e: 300000, n: 100000 }, 'SU': { e: 400000, n: 100000 },
    'SM': { e: 100000, n: 200000 }, 'SN': { e: 200000, n: 200000 }, 'SO': { e: 300000, n: 200000 }, 'SP': { e: 400000, n: 200000 },
    'SH': { e: 200000, n: 300000 }, 'SJ': { e: 300000, n: 300000 }, 'SK': { e: 400000, n: 300000 },
    'SC': { e: 200000, n: 400000 }, 'SD': { e: 300000, n: 400000 }, 'SE': { e: 400000, n: 400000 },
    'NW': { e: 100000, n: 500000 }, 'NX': { e: 200000, n: 500000 }, 'NY': { e: 300000, n: 500000 }, 'NZ': { e: 400000, n: 500000 },
    'NR': { e: 100000, n: 600000 }, 'NS': { e: 200000, n: 600000 }, 'NT': { e: 300000, n: 600000 }, 'NU': { e: 400000, n: 600000 },
    'NL': { e: 0, n: 700000 }, 'NM': { e: 100000, n: 700000 }, 'NN': { e: 200000, n: 700000 }, 'NO': { e: 300000, n: 700000 },
    'NF': { e: 0, n: 800000 }, 'NG': { e: 100000, n: 800000 }, 'NH': { e: 200000, n: 800000 }, 'NJ': { e: 300000, n: 800000 }, 'NK': { e: 400000, n: 800000 },
    'NA': { e: 0, n: 900000 }, 'NB': { e: 100000, n: 900000 }, 'NC': { e: 200000, n: 900000 }, 'ND': { e: 300000, n: 900000 },
    'HW': { e: 100000, n: 1000000 }, 'HX': { e: 200000, n: 1000000 }, 'HY': { e: 300000, n: 1000000 }, 'HZ': { e: 400000, n: 1000000 },
    'HP': { e: 400000, n: 1200000 },
    'TL': { e: 500000, n: 200000 }, 'TM': { e: 600000, n: 200000 },
    'TF': { e: 500000, n: 300000 }, 'TG': { e: 600000, n: 300000 },
    'TA': { e: 500000, n: 400000 },
    'TV': { e: 500000, n: 0 }, 'TQ': { e: 500000, n: 100000 }, 'TR': { e: 600000, n: 100000 }
  }

  const square = gridSquares[letters]
  if (!square) return null

  // Parse easting and northing from digits
  const half = digits.length / 2
  const eastDigits = digits.slice(0, half)
  const northDigits = digits.slice(half)

  // Scale to meters (6 digits = 1m precision, 4 digits = 100m, etc.)
  const scale = Math.pow(10, 5 - half)
  const easting = square.e + parseInt(eastDigits, 10) * scale
  const northing = square.n + parseInt(northDigits, 10) * scale

  // Convert OSGB36 easting/northing to WGS84 lat/lng
  return osgb36ToWgs84(easting, northing)
}

/**
 * Convert OSGB36 easting/northing to WGS84 lat/lng
 * Uses iterative algorithm for accuracy
 */
function osgb36ToWgs84(easting: number, northing: number): { lat: number; lng: number } {
  // Airy 1830 ellipsoid parameters
  const a = 6377563.396
  const b = 6356256.909
  const F0 = 0.9996012717
  const lat0 = 49 * Math.PI / 180
  const lon0 = -2 * Math.PI / 180
  const N0 = -100000
  const E0 = 400000
  const e2 = 1 - (b * b) / (a * a)
  const n = (a - b) / (a + b)
  const n2 = n * n
  const n3 = n * n * n

  let lat = lat0
  let M = 0

  // Iterative solution for latitude
  do {
    lat = (northing - N0 - M) / (a * F0) + lat

    const Ma = (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (lat - lat0)
    const Mb = (3 * n + 3 * n2 + (21 / 8) * n3) * Math.sin(lat - lat0) * Math.cos(lat + lat0)
    const Mc = ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0))
    const Md = (35 / 24) * n3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0))

    M = b * F0 * (Ma - Mb + Mc - Md)
  } while (Math.abs(northing - N0 - M) >= 0.00001)

  const cosLat = Math.cos(lat)
  const sinLat = Math.sin(lat)
  const nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat)
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5)
  const eta2 = nu / rho - 1
  const tanLat = Math.tan(lat)
  const tan2lat = tanLat * tanLat
  const tan4lat = tan2lat * tan2lat
  const tan6lat = tan4lat * tan2lat
  const secLat = 1 / cosLat
  const nu3 = nu * nu * nu
  const nu5 = nu3 * nu * nu
  const nu7 = nu5 * nu * nu
  const VII = tanLat / (2 * rho * nu)
  const VIII = tanLat / (24 * rho * nu3) * (5 + 3 * tan2lat + eta2 - 9 * tan2lat * eta2)
  const IX = tanLat / (720 * rho * nu5) * (61 + 90 * tan2lat + 45 * tan4lat)
  const X = secLat / nu
  const XI = secLat / (6 * nu3) * (nu / rho + 2 * tan2lat)
  const XII = secLat / (120 * nu5) * (5 + 28 * tan2lat + 24 * tan4lat)
  const XIIA = secLat / (5040 * nu7) * (61 + 662 * tan2lat + 1320 * tan4lat + 720 * tan6lat)

  const dE = easting - E0
  const dE2 = dE * dE
  const dE3 = dE2 * dE
  const dE4 = dE2 * dE2
  const dE5 = dE3 * dE2
  const dE6 = dE4 * dE2
  const dE7 = dE5 * dE2

  const latOsgb = lat - VII * dE2 + VIII * dE4 - IX * dE6
  const lonOsgb = lon0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7

  // Convert from OSGB36 to WGS84 using Helmert transformation
  const latWgs = latOsgb * 180 / Math.PI + helmertLat(latOsgb, lonOsgb)
  const lonWgs = lonOsgb * 180 / Math.PI + helmertLon(latOsgb, lonOsgb)

  return { lat: latWgs, lng: lonWgs }
}

/**
 * Helmert transformation latitude correction (degrees)
 */
function helmertLat(lat: number, lon: number): number {
  // Simplified Helmert parameters for OSGB36 to WGS84
  const tx = -446.448
  const ty = 125.157
  const tz = -542.060
  const s = 20.4894 / 1e6
  const rx = (-0.1502 / 3600) * Math.PI / 180
  const ry = (-0.2470 / 3600) * Math.PI / 180
  const rz = (-0.8421 / 3600) * Math.PI / 180

  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon)
  const cosLon = Math.cos(lon)

  // Approximate correction in degrees
  const dLat = (-tx * sinLat * cosLon - ty * sinLat * sinLon + tz * cosLat) / 111320
  return dLat + (rx * cosLon - ry * sinLon) * 3600 / 206265 + s * (dLat)
}

/**
 * Helmert transformation longitude correction (degrees)
 */
function helmertLon(lat: number, lon: number): number {
  const tx = -446.448
  const ty = 125.157
  const s = 20.4894 / 1e6
  const rz = (-0.8421 / 3600) * Math.PI / 180

  const cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon)
  const cosLon = Math.cos(lon)

  // Approximate correction in degrees
  const dLon = (-tx * sinLon + ty * cosLon) / (111320 * cosLat)
  return dLon + rz * 3600 / 206265 + s * (dLon)
}
