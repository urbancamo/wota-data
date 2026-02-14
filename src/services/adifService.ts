import {AdifParser} from 'adif-parser-ts'
import {parseWotaReference} from '../utils/wotaReference'
import {stripPortableSuffix} from '../../shared/utils'
import type {
  ActivatorLogInput,
  AdifRecord,
  ImportStatistics,
  ParsedAdif,
  ParseError,
  ValidationResult,
  ChaserImportRecord,
  ChaserImportResult,
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
    // Priority: MY_SOTA_REF takes precedence over MY_SIG_INFO
    const sotaRef = extractSotaReference(record)
    console.log(`Record for ${record.call}: my_sig="${record.my_sig}", my_sig_info="${record.my_sig_info}", my_sota_ref="${record.my_sota_ref}"`)

    if (sotaRef && sotaRef.toUpperCase().startsWith('G/LD')) {
      try {
        console.log(`Looking up MY_SOTA_REF: ${sotaRef}`)
        const summit = await apiClient.lookupSotaReference(sotaRef)
        if (summit) {
          console.log(`Found summit for ${sotaRef}: ${summit.name} (wotaid: ${summit.wotaid})`)
          // Set the WOTA reference for your station
          // This overrides any existing MY_SIG_INFO (like POTA references)
          record.my_sig_info = summit.wotaid.toString()
          record.my_sig = 'WOTA'
        } else {
          console.warn(`No summit found in database for SOTA reference: ${sotaRef}`)
        }
      } catch (error) {
        console.error(`Error looking up SOTA reference ${sotaRef}:`, error)
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

  // Warn if no WOTA reference - only count SIG_INFO/MY_SIG_INFO when the SIG field is WOTA
  const hasWotaSig = record.sig?.toUpperCase() === 'WOTA' && record.sig_info
  const hasWotaMySig = record.my_sig?.toUpperCase() === 'WOTA' && record.my_sig_info
  if (!hasWotaSig && !hasWotaMySig) {
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
  if (match && match[1]) {
    // Assume plain numbers <= 214 are LDW, > 214 need no conversion
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

// Re-export from shared utils for backwards compatibility
export { stripPortableSuffix } from '../../shared/utils'

export function mapToActivatorLog(record: AdifRecord | undefined): ActivatorLogInput | null {
  if (record === undefined) {
    return null
  }
  // Extract WOTA ID from MY_SIG_INFO (activator's summit), not SIG_INFO (station worked's summit)
  // Only parse references where the SIG field is WOTA to avoid misidentifying POTA etc.
  const mySigInfo = record.my_sig?.toUpperCase() === 'WOTA' ? record.my_sig_info : undefined
  const sigInfo = record.sig?.toUpperCase() === 'WOTA' ? record.sig_info : undefined
  const wotaId = extractWotaId(mySigInfo || sigInfo)

  if (!wotaId || !record.call || !record.qso_date) {
    return null
  }

  // Parse date (format: YYYYMMDD)
  // Use UTC to avoid timezone offset issues when storing in database
  const dateStr = record.qso_date
  const date = new Date(Date.UTC(
    parseInt(dateStr.substring(0, 4)),
    parseInt(dateStr.substring(4, 6)) - 1,
    parseInt(dateStr.substring(6, 8))
  ))

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
    .map((r) => {
      const sigInfo = r.sig?.toUpperCase() === 'WOTA' ? r.sig_info : undefined
      const mySigInfo = r.my_sig?.toUpperCase() === 'WOTA' ? r.my_sig_info : undefined
      return extractWotaId(mySigInfo || sigInfo)
    })
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

function formatAdifDate(adifDate: string | undefined): string {
  // Convert YYYYMMDD to YYYY-MM-DD
  if (adifDate === undefined)
    return '';

  const year = adifDate.substring(0, 4)
  const month = adifDate.substring(4, 6)
  const day = adifDate.substring(6, 8)
  return `${year}-${month}-${day}`
}

function formatAdifTime(adifTime: string | undefined): string {
  // Convert HHMMSS or HHMM to HH:MM:SS
  if (!adifTime) return ''

  const timeStr = adifTime.padEnd(6, '0') // Pad to HHMMSS if only HHMM
  const hours = timeStr.substring(0, 2)
  const minutes = timeStr.substring(2, 4)
  const seconds = timeStr.substring(4, 6)

  return `${hours}:${minutes}:${seconds}`
}

/**
 * Parse ADIF file for chaser log import
 */
export async function parseChaserAdifFile(file: File): Promise<ChaserImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const parsed = AdifParser.parseAdi(content)

        let adifRecords: AdifRecord[] = parsed.records || []
        const records: ChaserImportRecord[] = []

        // Process each ADIF record
        adifRecords.forEach((adifRecord) => {
          const sig = adifRecord.sig
          const sigInfo = adifRecord.sig_info
          const ucall = adifRecord.station_callsign
          const stncall = adifRecord.call
          const qsoDate = adifRecord.qso_date
          const timeOn = adifRecord.time_on

          const validationErrors: string[] = []
          let wotaRef = ''
          let sotaRef: string | undefined

          // Validate SIG field - accept both WOTA and SOTA, or fall back to SOTA_REF
          if (!sig) {
            // No SIG field - check for SOTA_REF as fallback
            if (adifRecord.sota_ref) {
              sotaRef = adifRecord.sota_ref.trim()
              wotaRef = sotaRef
            } else {
              validationErrors.push('SIG field or SOTA_REF is missing')
            }
          } else {
            const sigUpper = sig.toUpperCase()
            if (sigUpper === 'WOTA') {
              wotaRef = sigInfo || ''
            } else if (sigUpper === 'SOTA') {
              // Store SOTA reference for conversion
              sotaRef = sigInfo || ''
              wotaRef = sigInfo || '' // Will be converted later
            } else {
              validationErrors.push('SIG field must be "WOTA" or "SOTA"')
            }
          }

          // Validate required fields
          if (!sigInfo && !sotaRef) {
            validationErrors.push('SIG_INFO (WOTA/SOTA reference) or SOTA_REF is required')
          }

          if (!ucall) {
            validationErrors.push('STATION_CALLSIGN is required')
          }

          if (!stncall) {
            validationErrors.push('CALL is required')
          }

          if (!qsoDate) {
            validationErrors.push('QSO_DATE is required')
          }

          const year = qsoDate ? parseInt(qsoDate.substring(0, 4)) : 0

          // Validate year is within allowed range (matches PHP log_contact.php lines 31-51)
          const validYears = [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                              2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
          if (!validYears.includes(year)) {
            validationErrors.push(`Invalid year: ${year}. Must be between 2009-2026`)
          }

          records.push({
            ucall: ucall || '',
            stncall: stncall || '',
            wotaRef,
            sotaRef,
            date: qsoDate ? formatAdifDate(qsoDate) : '',
            time: timeOn ? formatAdifTime(timeOn) : undefined,
            year,
            isValid: validationErrors.length === 0,
            validationErrors
          })
        })

        const validRecords = records.filter(r => r.isValid).length

        resolve({
          records,
          totalRecords: records.length,
          validRecords,
          invalidRecords: records.length - validRecords
        })
      } catch (error) {
        reject(new Error(`Failed to parse chaser ADIF file: ${error}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

/**
 * Validate WOTA references and populate wotaid for chaser records
 * Also converts SOTA references (G/LD-xxx) to WOTA IDs
 */
export async function validateChaserWotaRefs(
  records: ChaserImportRecord[]
): Promise<ChaserImportRecord[]> {
  // Separate SOTA references from WOTA references
  const sotaRecords = records.filter(r => r.sotaRef)
  const wotaRecords = records.filter(r => !r.sotaRef && r.wotaRef)

  // Convert SOTA references to WOTA IDs
  const sotaConversionMap = new Map<string, number>()

  for (const record of sotaRecords) {
    if (!record.sotaRef) continue

    // Check if it's a Lake District SOTA reference (G/LD-xxx)
    if (record.sotaRef.toUpperCase().startsWith('G/LD')) {
      try {
        const response = await fetch(`/data/api/summits/sota/${encodeURIComponent(record.sotaRef)}`)
        if (response.ok) {
          const summit = await response.json()
          sotaConversionMap.set(record.sotaRef, summit.wotaid)
        }
      } catch (error) {
        console.error(`Failed to convert SOTA reference ${record.sotaRef}:`, error)
      }
    }
  }

  // Get unique WOTA references that need validation
  const uniqueWotaRefs = [...new Set(wotaRecords.map(r => r.wotaRef).filter(Boolean))]

  let wotaValidationMap = new Map<string, number>()

  if (uniqueWotaRefs.length > 0) {
    try {
      const response = await fetch('/data/api/summits/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ references: uniqueWotaRefs })
      })

      if (!response.ok) {
        throw new Error('Validation request failed')
      }

      const { valid } = await response.json()

      // Create a map of valid references to their IDs
      wotaValidationMap = new Map<string, number>(
        valid.map((v: { ref: string; id: number }) => [v.ref, v.id])
      )
    } catch (error) {
      console.error('WOTA reference validation failed:', error)
    }
  }

  // Update records with validation results
  return records.map(record => {
    if (!record.wotaRef) return record

    // Check if this is a SOTA reference
    if (record.sotaRef) {
      const wotaid = sotaConversionMap.get(record.sotaRef)
      if (wotaid !== undefined) {
        // Valid SOTA reference converted to WOTA
        return { ...record, wotaid }
      } else {
        // Invalid SOTA reference (not G/LD or not found)
        return {
          ...record,
          isValid: false,
          validationErrors: [...record.validationErrors, `Invalid or non-WOTA SOTA reference: ${record.sotaRef}`]
        }
      }
    }

    // Regular WOTA reference
    const wotaid = wotaValidationMap.get(record.wotaRef)
    if (wotaid !== undefined) {
      // Valid reference - populate wotaid
      return { ...record, wotaid }
    } else {
      // Invalid reference - mark as invalid
      return {
        ...record,
        isValid: false,
        validationErrors: [...record.validationErrors, `Invalid WOTA reference: ${record.wotaRef}`]
      }
    }
  })
}

/**
 * Check for duplicate chaser records
 */
export async function checkChaserDuplicates(
  records: ChaserImportRecord[]
): Promise<ChaserImportRecord[]> {
  try {
    const response = await fetch('/data/api/import/check-chaser-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records })
    })

    if (!response.ok) {
      throw new Error('Duplicate check request failed')
    }

    const { duplicates } = await response.json()
    const duplicateSet = new Set(duplicates)

    return records.map((record, index) => ({
      ...record,
      isDuplicate: duplicateSet.has(index)
    }))
  } catch (error) {
    console.error('Duplicate check failed:', error)
    return records
  }
}
