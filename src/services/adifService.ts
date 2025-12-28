import { AdifParser } from 'adif-parser-ts'
import { parseWotaReference } from '../utils/wotaReference'
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

        let records: AdifRecord[] = parsed.records || []
        const errors: ParseError[] = []

        // Filter out invalid records (e.g., header parsed as record)
        // Keep only records that have at minimum a CALL field
        records = records.filter((record) => {
          if (!record.call) {
            console.log('Filtering out invalid record without CALL field:', record)
            return false
          }
          return true
        })

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
    // Convert MY_SOTA_REF (your station's summit) to WOTA
    if (!record.my_sig_info) {
      const sotaRef = extractSotaReference(record)
      if (sotaRef && sotaRef.toUpperCase().startsWith('G/LD')) {
        try {
          console.log(`Looking up MY_SOTA_REF: ${sotaRef}`)
          const summit = await apiClient.lookupSotaReference(sotaRef)
          if (summit) {
            console.log(`Found summit for ${sotaRef}: ${summit.name} (wotaid: ${summit.wotaid})`)
            // Set the WOTA reference for your station
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

    // Convert SOTA_REF (station worked's summit) to WOTA for S2S detection
    if (!record.sig_info && record.sota_ref && record.sota_ref.toUpperCase().startsWith('G/LD')) {
      try {
        console.log(`Looking up SOTA_REF for S2S: ${record.sota_ref}`)
        const summit = await apiClient.lookupSotaReference(record.sota_ref)
        if (summit) {
          console.log(`Found WOTA summit for ${record.sota_ref}: ${summit.name} (wotaid: ${summit.wotaid})`)
          // Set SIG/SIG_INFO to indicate station worked was on a WOTA summit
          record.sig_info = summit.wotaid.toString()
          record.sig = 'WOTA'
        } else {
          console.log(`SOTA_REF ${record.sota_ref} is not a WOTA summit - no S2S`)
        }
      } catch (error) {
        console.error(`Error looking up SOTA_REF ${record.sota_ref}:`, error)
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

  // Try to parse as formatted WOTA reference (LDW-XXX or LDO-XXX)
  const wotaId = parseWotaReference(sigInfo.toUpperCase())
  if (wotaId !== null) {
    return wotaId
  }

  // Fallback: extract plain number for backward compatibility
  const match = sigInfo.match(/(\d+)/)
  if (match) {
    const num = parseInt(match[1], 10)
    // Assume plain numbers <= 214 are LDW, > 214 need no conversion
    return num
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
  // Extract WOTA ID from MY_SIG_INFO (activator's summit), not SIG_INFO (station worked's summit)
  const wotaId = extractWotaId(record.my_sig_info || record.sig_info)

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

  // Parse time (format: HHMM or HHMMSS)
  let time: Date | undefined
  if (record.time_on) {
    const timeStr = record.time_on.padEnd(6, '0') // Pad to HHMMSS if only HHMM
    const hours = parseInt(timeStr.substring(0, 2))
    const minutes = parseInt(timeStr.substring(2, 4))
    const seconds = parseInt(timeStr.substring(4, 6))

    // Create a Date object with time only (MySQL TIME type)
    time = new Date()
    time.setHours(hours, minutes, seconds, 0)
  }

  // Determine if Summit-to-Summit (station worked was also on a WOTA summit)
  // Note: convertSotaToWota() has already converted SOTA_REF to SIG/SIG_INFO if it's a WOTA summit
  const isS2S = !!(record.sig?.toUpperCase() === 'WOTA' && record.sig_info)

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
    stncall: stripPortableSuffix(record.call).substring(0, 12),
    ucall: record.call.substring(0, 8),
    rpt: undefined,  // Always null
    s2s: isS2S,  // true or false
    confirmed: false,  // Defaults to false (updated by separate job)
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
