import { AdifParser } from 'adif-parser-ts'
import type {
  AdifRecord,
  ParsedAdif,
  ValidationResult,
  ActivatorLogInput,
  ImportStatistics,
  ParseError,
} from '../types/adif'

export async function parseAdifFile(file: File): Promise<ParsedAdif> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        const parsed = AdifParser.parseAdi(content)

        const records: AdifRecord[] = parsed.records || []
        const errors: ParseError[] = []

        // Convert SOTA references to WOTA references
        await convertSotaToWota(records)

        // Validate each record
        records.forEach((record, index) => {
          const validation = validateRecord(record)
          if (!validation.valid) {
            validation.errors.forEach((error) => {
              errors.push({
                recordIndex: index,
                message: error,
              })
            })
          }
        })

        resolve({ records, errors })
      } catch (error) {
        reject(new Error(`Failed to parse ADIF file: ${error}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

async function convertSotaToWota(records: AdifRecord[]): Promise<void> {
  // Import apiClient here to avoid circular dependency
  const { apiClient } = await import('./api')

  for (const record of records) {
    // Skip if already has a WOTA reference
    if (record.my_sig_info || record.sig_info) {
      continue
    }

    const sotaRef = extractSotaReference(record)
    if (sotaRef && sotaRef.toUpperCase().startsWith('G/LD')) {
      try {
        console.log(`Looking up SOTA reference: ${sotaRef}`)
        const summit = await apiClient.lookupSotaReference(sotaRef)
        if (summit) {
          console.log(`Found summit for ${sotaRef}: ${summit.name} (wotaid: ${summit.wotaid})`)
          // Set the WOTA reference
          record.my_sig_info = summit.wotaid.toString()
          record.my_sig = 'WOTA'
        } else {
          console.warn(`No summit found in database for SOTA reference: ${sotaRef}`)
        }
      } catch (error) {
        console.error(`Error looking up SOTA reference ${sotaRef}:`, error)
      }
    }
  }
}

export function validateRecord(record: AdifRecord): ValidationResult {
  const errors: string[] = []

  // Required fields
  if (!record.call) {
    errors.push('Missing CALL field')
  }

  if (!record.qso_date) {
    errors.push('Missing QSO_DATE field')
  }

  // Warn if no WOTA reference
  if (!record.sig_info && !record.my_sig_info) {
    errors.push('Missing WOTA reference (SIG_INFO or MY_SIG_INFO)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function extractWotaId(sigInfo: string | undefined): number | null {
  if (!sigInfo) return null

  // Handle formats like "LDW-001", "LDW-1", "001", "1"
  const match = sigInfo.match(/(\d+)/)
  if (match) {
    return parseInt(match[1], 10)
  }

  return null
}

export function extractSotaReference(record: AdifRecord): string | null {
  // Check MY_SOTA_REF field first
  if (record.my_sota_ref) {
    return record.my_sota_ref.trim()
  }

  // Check if MY_SIG field is "SOTA" and extract MY_SIG_INFO
  if (record.my_sig?.toUpperCase() === 'SOTA' && record.my_sig_info) {
    return record.my_sig_info.trim()
  }

  return null
}

// Helper function to strip /P or /M suffix from callsign
function stripPortableSuffix(callsign: string): string {
  return callsign.replace(/\/[PM]$/i, '')
}

export function mapToActivatorLog(record: AdifRecord): ActivatorLogInput | null {
  // Extract WOTA ID from SIG_INFO or MY_SIG_INFO
  const wotaId = extractWotaId(record.sig_info || record.my_sig_info)

  if (!wotaId || !record.call || !record.qso_date) {
    return null
  }

  // Parse date (format: YYYYMMDD)
  const dateStr = record.qso_date
  const date = new Date(
    parseInt(dateStr.substring(0, 4)),
    parseInt(dateStr.substring(4, 6)) - 1,
    parseInt(dateStr.substring(6, 8))
  )

  // Parse time if present (format: HHMMSS or HHMM)
  let time: Date | undefined
  if (record.time_on) {
    const timeStr = record.time_on.padEnd(6, '0')
    time = new Date()
    time.setHours(parseInt(timeStr.substring(0, 2)))
    time.setMinutes(parseInt(timeStr.substring(2, 4)))
    time.setSeconds(parseInt(timeStr.substring(4, 6)))
  }

  // Determine if Summit-to-Summit
  const isS2S =
    record.sig?.toUpperCase() === 'WOTA' && record.sig_info ? 1 : 0

  // Strip /P or /M suffix from callused before storing
  const rawCallused = record.station_callsign || record.operator || ''
  const cleanCallused = stripPortableSuffix(rawCallused)

  return {
    activatedby: (record.operator || record.station_callsign || '').substring(0, 11),
    callused: cleanCallused.substring(0, 8),
    wotaid: wotaId,
    date,
    time,
    year: date.getFullYear(),
    stncall: record.call.substring(0, 12),
    ucall: record.call.substring(0, 8),
    rpt: record.rst_sent ? 1 : undefined,
    s2s: isS2S || undefined,
    confirmed: undefined,
    band: record.band?.substring(0, 8),
    frequency: record.freq ? parseFloat(record.freq) : undefined,
    mode: record.mode?.substring(0, 32),
  }
}

export function calculateStatistics(
  records: AdifRecord[],
  errors: ParseError[]
): ImportStatistics {
  const validRecords = records.filter((r) => {
    const validation = validateRecord(r)
    return validation.valid
  })

  const dates = validRecords
    .map((r) => r.qso_date)
    .filter((d): d is string => !!d)
    .sort()

  const summitIds = validRecords
    .map((r) => extractWotaId(r.sig_info || r.my_sig_info))
    .filter((id): id is number => id !== null)

  const uniqueSummits = Array.from(new Set(summitIds))

  return {
    totalQsos: records.length,
    dateRange:
      dates.length > 0
        ? {
            start: formatAdifDate(dates[0]),
            end: formatAdifDate(dates[dates.length - 1]),
          }
        : null,
    summits: uniqueSummits,
    errors: errors.length,
    validRecords: validRecords.length,
  }
}

function formatAdifDate(adifDate: string): string {
  // Convert YYYYMMDD to YYYY-MM-DD
  const year = adifDate.substring(0, 4)
  const month = adifDate.substring(4, 6)
  const day = adifDate.substring(6, 8)
  return `${year}-${month}-${day}`
}
